import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { getRemainingUsd } from "@/lib/budget";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();

    const [postsRes, usage] = await Promise.all([
      supabase
        .from("terminal_posts")
        .select("id, content, x_post_url, posted_at")
        .is("error", null)
        .order("posted_at", { ascending: false })
        .limit(50),
      getRemainingUsd(supabase),
    ]);

    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      posts: postsRes.data ?? [],
      usage,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
