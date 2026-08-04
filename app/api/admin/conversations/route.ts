import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// Owner-only: read-only transcript for one user — main terminal chat plus
// their Undervoice sessions (open or closed).
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const [{ data: chatMessages }, { data: sessions }] = await Promise.all([
    supabase
      .from("terminal_chat_messages")
      .select("role, content, created_at, is_gossip")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("terminal_undervoice_sessions")
      .select("id, status, opened_at, closed_at, outcome, message_count")
      .eq("user_id", userId)
      .order("opened_at", { ascending: false }),
  ]);

  type UndervoiceMessage = {
    session_id: string;
    role: string;
    content: string;
    mood: string;
    created_at: string;
  };

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  let undervoiceMessages: UndervoiceMessage[] = [];
  if (sessionIds.length) {
    const { data } = await supabase
      .from("terminal_undervoice_messages")
      .select("session_id, role, content, mood, created_at")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: true });
    undervoiceMessages = (data ?? []) as UndervoiceMessage[];
  }

  const messagesBySession = new Map<string, UndervoiceMessage[]>();
  for (const m of undervoiceMessages) {
    if (!messagesBySession.has(m.session_id)) messagesBySession.set(m.session_id, []);
    messagesBySession.get(m.session_id)!.push(m);
  }

  return NextResponse.json({
    chatMessages: chatMessages ?? [],
    undervoiceSessions: (sessions ?? []).map((s) => ({
      ...s,
      messages: messagesBySession.get(s.id as string) ?? [],
    })),
  });
}
