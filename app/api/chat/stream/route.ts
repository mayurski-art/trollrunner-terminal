import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// How often the held-open connection checks for new rows. This is a
// server-side Postgres query, not network traffic — the wire to the browser
// stays silent unless there is something to send, which is the whole reason
// this is SSE and not a client poll (docs/LIVE-HOP-IN-DESIGN.md §2.1).
const TICK_MS = 2000;
// Closed deliberately well under maxDuration so the stream ends cleanly and
// the client reconnects, rather than being killed at the ceiling mid-write.
const STREAM_MS = 45_000;
// Proxies drop idle connections; a comment line keeps this one alive without
// being parsed as an event by the client.
const HEARTBEAT_MS = 15_000;

// Only what the transcript renders. Deliberately excludes from_owner (the
// troublemaker must never be able to tell an injected message from a
// generated one) and the cost/token columns.
const DISPLAY_COLUMNS = "role, content, created_at, is_gossip, image_url, image_caption";

// Streams this user's own new chat messages as they land. The initial history
// still comes from GET /api/chat — this only carries what arrives after the
// page is already open, including messages the owner injects out-of-band via
// /api/admin/say.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return Response.json({ error: "sign in required" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ error: "invalid session" }, { status: 401 });
  }
  const userId = userData.user.id;

  // Everything already on screen is the client's problem; this connection is
  // only responsible for what shows up from now on.
  const { searchParams } = new URL(request.url);
  const afterParam = searchParams.get("after");
  const parsedAfter = afterParam ? Date.parse(afterParam) : NaN;
  let after = Number.isNaN(parsedAfter) ? new Date().toISOString() : new Date(parsedAfter).toISOString();

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The client went away between the check and the write.
          closed = true;
        }
      };

      const shutdown = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        if (heartbeat) clearInterval(heartbeat);
        if (closeTimer) clearTimeout(closeTimer);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      // A client that navigates away mid-stream aborts the request; without
      // this the interval would keep querying Postgres for a reader that no
      // longer exists.
      request.signal.addEventListener("abort", shutdown);

      // Tells the client the stream is alive before any message exists, so a
      // failed connection is distinguishable from a quiet one.
      send(": open\n\n");

      const tick = async () => {
        if (closed) return;
        const { data, error } = await supabase
          .from("terminal_chat_messages")
          .select(DISPLAY_COLUMNS)
          .eq("user_id", userId)
          .gt("created_at", after)
          .order("created_at", { ascending: true })
          .limit(20);

        if (error) {
          console.error("[chat/stream] query failed:", error.message);
          return;
        }
        if (!data || data.length === 0) return;

        after = data[data.length - 1].created_at as string;
        send(`data: ${JSON.stringify({ messages: data })}\n\n`);
      };

      timer = setInterval(() => void tick(), TICK_MS);
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      closeTimer = setTimeout(shutdown, STREAM_MS);
    },
    cancel() {
      if (timer) clearInterval(timer);
      if (heartbeat) clearInterval(heartbeat);
      if (closeTimer) clearTimeout(closeTimer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx-style proxies buffer responses by default, which would hold
      // events until the stream ends and defeat the point entirely.
      "X-Accel-Buffering": "no",
    },
  });
}
