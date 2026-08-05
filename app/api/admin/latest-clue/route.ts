import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";

// Owner-only: the clue behind the most recent voice transmission. Same
// requireOwner() gate as /api/admin/users (powers the [ inspect ] page) —
// nobody but troll_runner can ever see this.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  const { data: post, error } = await supabase
    .from("terminal_posts")
    .select("id, clue_tag, posted_at")
    .is("error", null)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    postId: post?.id ?? null,
    clue: post?.clue_tag ?? null,
  });
}
