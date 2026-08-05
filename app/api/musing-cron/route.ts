import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generateMusing } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

// Same trigger shape as /api/cron, on its own schedule (see
// .github/workflows/musing-cron.yml) — generates a private "train of
// thought" note and saves it to terminal_musings. Shown on the homepage and
// fed into live chat context (see app/api/chat/route.ts).
export async function GET(request: Request) {
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

  const [{ data: musingRows }, { data: postRows }] = await Promise.all([
    supabase
      .from("terminal_musings")
      .select("content, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("terminal_posts")
      .select("content, posted_at")
      .order("posted_at", { ascending: false })
      .limit(10),
  ]);

  const recentMusings = (musingRows ?? []).map((r) => ({
    content: r.content as string,
    created_at: r.created_at as string,
  }));
  const recentPosts = (postRows ?? []).map((r) => ({
    content: r.content as string,
    posted_at: r.posted_at as string,
  }));

  let generated: Awaited<ReturnType<typeof generateMusing>>;
  try {
    generated = await generateMusing(recentMusings, recentPosts);
  } catch (err) {
    return NextResponse.json(
      { error: `generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const estimatedCostUsd = estimateCostUsd(generated.usage);

  const { error: insertError } = await supabase.from("terminal_musings").insert({
    content: generated.content,
    answer_tag: generated.answerTag || null,
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
