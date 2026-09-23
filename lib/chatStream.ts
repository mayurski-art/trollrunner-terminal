// Client transport for /api/chat/stream.
//
// EventSource would be the obvious choice, but it cannot set an Authorization
// header — which would force the access token into the query string, where it
// lands in logs. A fetch + ReadableStream reader keeps auth on the header like
// every other call in this app, at the cost of owning the reconnect loop
// ourselves (which EventSource would otherwise do).

// The server closes each connection at 45s by design, so reconnecting is the
// normal case, not an error — the first retry is immediate.
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 30_000;

export type StreamMessage = {
  role: "user" | "terminal";
  content: string;
  created_at: string;
  is_gossip?: boolean;
  image_url?: string | null;
  image_caption?: string | null;
};

type StreamOptions = {
  // Resolves the Authorization header freshly on every reconnect — a stream
  // that outlives the access token would otherwise reconnect forever with a
  // stale one.
  getAuthHeader: () => Promise<Record<string, string>>;
  onMessages: (messages: StreamMessage[]) => void;
  // Only what arrived after this point; everything earlier is already on
  // screen from the initial GET /api/chat.
  since?: string;
};

// Opens the stream and keeps it open across the server's scheduled closes.
// Returns a stop function; call it on unmount and whenever the tab is hidden.
export function openChatStream({ getAuthHeader, onMessages, since }: StreamOptions): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  // Advanced past every message handed to onMessages, so a reconnect resumes
  // exactly where the last connection left off instead of replaying.
  let after = since ?? new Date().toISOString();

  async function connect() {
    if (stopped) return;
    controller = new AbortController();
    try {
      const headers = await getAuthHeader();
      if (!headers.Authorization) {
        scheduleRetry();
        return;
      }
      const res = await fetch(`/api/chat/stream?after=${encodeURIComponent(after)}`, {
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      if (!res.ok || !res.body) {
        scheduleRetry();
        return;
      }

      failures = 0;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line. Anything after the last
        // one is a partial frame and stays in the buffer for the next read.
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue; // ": open" / ": ping" heartbeats
          try {
            const payload = JSON.parse(line.slice(5).trim()) as { messages?: StreamMessage[] };
            const messages = payload.messages ?? [];
            if (messages.length === 0) continue;
            after = messages[messages.length - 1].created_at;
            onMessages(messages);
          } catch {
            // A malformed frame shouldn't tear down a working stream.
          }
        }
      }
      // A clean end is the server's scheduled 45s close — reconnect at once.
      if (!stopped) scheduleRetry(true);
    } catch {
      // AbortError from stop() lands here too; the stopped guard covers it.
      if (!stopped) scheduleRetry();
    }
  }

  function scheduleRetry(immediate = false) {
    if (stopped) return;
    const delay = immediate
      ? 0
      : Math.min(RETRY_BASE_MS * 2 ** failures++, RETRY_MAX_MS);
    retryTimer = setTimeout(() => void connect(), delay);
  }

  void connect();

  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    controller?.abort();
  };
}
