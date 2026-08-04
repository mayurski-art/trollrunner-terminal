import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// Owner-only: one row per user with terminal activity, for the [ inspect ]
// user list. Usernames live in auth.user_metadata, not a public table, so
// they're resolved via the admin listUsers() API (service-role only) and
// joined in-memory against terminal_wallets / terminal_undervoice_sessions.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  const [{ data: authUsers }, { data: wallets }, { data: openSessions }, { data: lastActive }] =
    await Promise.all([
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase
        .from("terminal_wallets")
        .select("user_id, balance, friendship_score"),
      supabase
        .from("terminal_undervoice_sessions")
        .select("user_id")
        .eq("status", "open"),
      supabase
        .from("terminal_chat_messages")
        .select("user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

  const usernameById = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, (u.user_metadata?.username as string | undefined) ?? "unknown"])
  );
  const walletById = new Map((wallets ?? []).map((w) => [w.user_id as string, w]));
  const openSessionUserIds = new Set((openSessions ?? []).map((s) => s.user_id as string));

  const lastActiveById = new Map<string, string>();
  for (const row of lastActive ?? []) {
    const id = row.user_id as string;
    if (!lastActiveById.has(id)) lastActiveById.set(id, row.created_at as string);
  }

  const userIds = new Set<string>([...walletById.keys(), ...lastActiveById.keys(), ...openSessionUserIds]);

  const users = Array.from(userIds)
    .map((id) => ({
      userId: id,
      username: usernameById.get(id) ?? "unknown",
      balance: walletById.get(id)?.balance ?? 0,
      friendshipScore: walletById.get(id)?.friendship_score ?? 0,
      liveUndervoice: openSessionUserIds.has(id),
      lastActiveAt: lastActiveById.get(id) ?? null,
    }))
    .sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));

  return NextResponse.json({ users });
}
