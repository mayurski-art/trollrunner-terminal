import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import { generatePost } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";
import { checkAndReserveSpend, recordSpend } from "@/lib/budget";

export const runtime = "nodejs";
export const maxDuration = 60;

// Owner-only "generate one right now" button next to the homepage's latest
// transmission panel — same generation path as the scheduled /api/cron GET,
// just triggered on demand instead of by Vercel Cron, and gated by
// requireOwner() instead of CRON_SECRET. Still respects is_paused and the
// same daily spend cap so a manual click can't blow past the budget guard.
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { supabase } = owner;

  const { data: config } = await supabase
    .from("terminal_config")
    .select("is_paused")
    .single();

  if (config?.is_paused) {
    return NextResponse.json({ error: "the terminal is paused" }, { status: 400 });
  }

  const spendCheck = await checkAndReserveSpend(supabase);
  if (!spendCheck.allowed) {
    return NextResponse.json(
      { error: spendCheck.reason === "daily_cap" ? "daily spend cap reached" : "balance too low" },
      { status: 400 }
    );
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
    generated = await generatePost(recent, recent.length);
  } catch (err) {
    return NextResponse.json(
      { error: `generation failed: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const estimatedCostUsd = estimateCostUsd(generated.usage);
  await recordSpend(supabase, estimatedCostUsd);

  const { data: post, error: insertError } = await supabase
    .from("terminal_posts")
    .insert({
      content: generated.content,
      clue_tag: generated.clueTag || null,
      input_tokens: generated.usage.input_tokens,
      output_tokens: generated.usage.output_tokens,
      cache_creation_input_tokens: generated.usage.cache_creation_input_tokens,
      cache_read_input_tokens: generated.usage.cache_read_input_tokens,
      estimated_cost_usd: estimatedCostUsd,
    })
    .select("id, content, x_post_url, art_url, posted_at")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ post });
}
