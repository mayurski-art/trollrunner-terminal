import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_MEMORIES = 30; // bounds what gets stuffed into every future chat prompt
const MAX_CONTENT_LENGTH = 1000;

async function authedUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// List the troublemaker's pinned memories, oldest first (same order they'll
// be read into the chat prompt), so the UI can show what's already remembered.
export async function GET(request: Request) {
  const userId = await authedUserId(request);
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("terminal_memories")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: "could not load memory" }, { status: 500 });
  return NextResponse.json({ memories: data ?? [] });
}

// Pin a message as remembered. FIFO-evicts the oldest memory once the cap is
// hit, so a chatty user can't unboundedly grow every future prompt.
export async function POST(request: Request) {
  const userId = await authedUserId(request);
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  let body: { content?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const content = (body.content ?? "").trim();
  const role = body.role === "terminal" ? "terminal" : "user";
  if (!content) return NextResponse.json({ error: "nothing to remember" }, { status: 400 });
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "that message is too long to pin" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("terminal_memories")
    .select("id")
    .eq("user_id", userId)
    .eq("content", content)
    .maybeSingle();
  if (existing) return NextResponse.json({ memory: existing, alreadyRemembered: true });

  const { count } = await supabase
    .from("terminal_memories")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if ((count ?? 0) >= MAX_MEMORIES) {
    const { data: oldest } = await supabase
      .from("terminal_memories")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit((count ?? 0) - MAX_MEMORIES + 1);
    const staleIds = (oldest ?? []).map((r) => r.id);
    if (staleIds.length) {
      await supabase.from("terminal_memories").delete().in("id", staleIds);
    }
  }

  const { data: inserted, error } = await supabase
    .from("terminal_memories")
    .insert({ user_id: userId, role, content })
    .select("id, role, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: "could not remember that" }, { status: 500 });
  return NextResponse.json({ memory: inserted });
}

// Unpin one memory.
export async function DELETE(request: Request) {
  const userId = await authedUserId(request);
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("terminal_memories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "could not forget that" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
