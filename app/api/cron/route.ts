import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generatePost } from "@/lib/persona";
import { postToX } from "@/lib/x";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Vercel Cron sends this header on scheduled invocations; require it (or a
  // manual secret) so the route can't be triggered by a random public GET.
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: config } = await supabase
    .from("terminal_config")
    .select("is_paused")
    .single();

  if (config?.is_paused) {
    return NextResponse.json({ skipped: true, reason: "paused" });
  }

  const { data: recentRows } = await supabase
    .from("terminal_posts")
    .select("content, posted_at")
    .order("posted_at", { ascending: false })
    .limit(15);

  const recent = (recentRows ?? []).map((r) => ({
    content: r.content as string,
    posted_at: r.posted_at as string,
  }));

  let content: string;
  try {
    content = await generatePost(recent);
  } catch (err) {
    return NextResponse.json(
      { error: `generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  try {
    const posted = await postToX(content);
    await supabase.from("terminal_posts").insert({
      content,
      x_post_id: posted.id,
      x_post_url: posted.url,
    });
    return NextResponse.json({ posted: true, id: posted.id, content });
  } catch (err) {
    // Record the generated content even on a failed X post so it isn't lost
    // and doesn't get silently regenerated next run.
    await supabase.from("terminal_posts").insert({
      content,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: `post to X failed: ${(err as Error).message}`, content },
      { status: 500 }
    );
  }
}
