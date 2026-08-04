import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

const LIVE_WINDOW_MS = 3 * 60 * 1000; // main chat counts as "live" if active in the last 3 minutes

// Owner-only: cheap poll target for the [ inspect ] "live now" list — open
// Undervoice sessions, plus anyone whose main chat had a message recently.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  const [{ data: openSessions }, { data: recentMessages }] = await Promise.all([
    supabase
      .from("terminal_undervoice_sessions")
      .select("user_id, id, opened_at, message_count")
      .eq("status", "open"),
    supabase
      .from("terminal_chat_messages")
      .select("user_id, created_at")
      .gte("created_at", new Date(Date.now() - LIVE_WINDOW_MS).toISOString()),
  ]);

  const liveUserIds = new Set<string>([
    ...(openSessions ?? []).map((s) => s.user_id as string),
    ...(recentMessages ?? []).map((m) => m.user_id as string),
  ]);

  if (liveUserIds.size === 0) {
    return NextResponse.json({ live: [] });
  }

  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const usernameById = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, (u.user_metadata?.username as string | undefined) ?? "unknown"])
  );

  const live = Array.from(liveUserIds).map((userId) => ({
    userId,
    username: usernameById.get(userId) ?? "unknown",
    liveUndervoice: (openSessions ?? []).some((s) => s.user_id === userId),
    liveChat: (recentMessages ?? []).some((m) => m.user_id === userId),
  }));

  return NextResponse.json({ live });
}
