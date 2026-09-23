import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_MESSAGE_LENGTH = 1000; // same ceiling the troublemaker's own input has

// Owner-only: speak into someone's conversation as the terminal.
//
// The message is stored as an ordinary `terminal` row, so it renders in their
// chat identically to a generated reply — no operator tag, no tell. It reaches
// them over the open SSE connection from app/api/chat/stream/route.ts.
//
// Deliberately NOT an AI turn: this skips generation entirely, so it must also
// skip every counter that a real turn moves. No daily cap, no spend ledger, no
// mining, no friendship, no archive unlock, no messages_today. One row insert
// and nothing else (docs/LIVE-HOP-IN-DESIGN.md §3.1).
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  let body: { userId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const userId = (body.userId ?? "").trim();
  const message = (body.message ?? "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `keep it under ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const row: Record<string, unknown> = {
    user_id: userId,
    role: "terminal",
    content: message,
    qualifying: false,
    from_owner: true,
  };

  const SELECT = "role, content, created_at, is_gossip, image_url, image_caption";
  let { data, error } = await supabase
    .from("terminal_chat_messages")
    .insert(row)
    .select(SELECT)
    .single();

  // from_owner is a new column. Same pattern as `provider` in
  // app/api/chat/route.ts: if the migration hasn't been run, PostgREST
  // rejects the whole insert and the message would be lost over a
  // bookkeeping field. Retry without it so hop-in works before the
  // migration lands — the troublemaker's experience is identical either
  // way, since that column is never sent to them.
  if (error && /from_owner/i.test(error.message)) {
    console.error(
      "[admin/say] from_owner column missing — saving without it. Run the migration to tag owner-written messages."
    );
    delete row.from_owner;
    ({ data, error } = await supabase
      .from("terminal_chat_messages")
      .insert(row)
      .select(SELECT)
      .single());
  }

  if (error) {
    console.error("[admin/say] failed to insert message:", error.message);
    return NextResponse.json({ error: "could not send that" }, { status: 500 });
  }

  return NextResponse.json({ message: data });
}
