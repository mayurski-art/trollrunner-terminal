import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generatePost } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

// Generates a post on schedule and saves it for manual posting to X — see
// README for why auto-posting was dropped (X API write access requires a
// paid tier).
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

  let generated: Awaited<ReturnType<typeof generatePost>>;
  try {
    generated = await generatePost(recent);
  } catch (err) {
    return NextResponse.json(
      { error: `generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const estimatedCostUsd = estimateCostUsd(generated.usage);

  const { error: insertError } = await supabase.from("terminal_posts").insert({
    content: generated.content,
    clue_tag: generated.clueTag || null,
    input_tokens: generated.usage.input_tokens,
    output_tokens: generated.usage.output_tokens,
    cache_creation_input_tokens: generated.usage.cache_creation_input_tokens,
    cache_read_input_tokens: generated.usage.cache_read_input_tokens,
    estimated_cost_usd: estimatedCostUsd,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    generated: true,
    content: generated.content,
    estimatedCostUsd,
  });
}
