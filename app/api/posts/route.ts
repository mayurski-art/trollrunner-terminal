import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Public + unauthenticated. This deliberately does NOT return credit/spend
// figures any more — that `usage` object was readable by every visitor via
// a plain curl. It now lives behind requireOwner() at
// /api/admin/credits.
export async function GET() {
  try {
    const supabase = getServiceClient();

    const postsRes = await supabase
      .from("terminal_posts")
      .select("id, content, x_post_url, art_url, posted_at")
      // Awaiting the owner accept/trash review — see migration 016.
      .eq("pending", false)
      .is("error", null)
      .order("posted_at", { ascending: false })
      .limit(50);

    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: postsRes.data ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
