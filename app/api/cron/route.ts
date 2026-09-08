import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generatePost, WireDownError } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";
import { checkAndReserveSpend, recordSpend } from "@/lib/budget";

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

  // Now that the scheduled transmission waits for the owner's accept (see the
  // insert below), generating another one on top of an unreviewed draft would
  // strand the first: the review card only ever shows the newest pending post,
  // so everything behind it becomes invisible to the owner and to the public
  // both. One waiting draft at a time — a day the owner didn't get to simply
  // doesn't produce a second one, and no free-tier call is spent on it.
  const { data: awaitingReview } = await supabase
    .from("terminal_posts")
    .select("id")
    .eq("pending", true)
    .is("error", null)
    .limit(1)
    .maybeSingle();

  if (awaitingReview) {
    return NextResponse.json({ skipped: true, reason: "a transmission is still awaiting review" });
  }

  const spendCheck = await checkAndReserveSpend(supabase);
  if (!spendCheck.allowed) {
    return NextResponse.json({ skipped: true, reason: spendCheck.reason });
  }

  const { data: recentRows } = await supabase
    .from("terminal_posts")
    .select("content, posted_at")
    // A pending post is one the owner may still trash, so it must not shape
    // the next transmission as if it were part of the published history.
    .eq("pending", false)
    .order("posted_at", { ascending: false })
    .limit(15);

  const recent = (recentRows ?? []).map((r) => ({
    content: r.content as string,
    posted_at: r.posted_at as string,
  }));

  // Date.now() rather than recent.length — see admin/generate-transmission's
  // identical fix for why a length-based seed can repeat the same provider.
  let generated: Awaited<ReturnType<typeof generatePost>>;
  try {
    generated = await generatePost(recent, Date.now());
  } catch (err) {
    // There is no paid fallback behind the free providers any more, so a
    // failure here means the transmission simply doesn't happen. The cron
    // runs off-platform (cron-job.org), so a 500 body alone goes nowhere —
    // record it as a row instead. terminal_posts.error is excluded from
    // both the public feed and the transmit page, so this surfaces the
    // outage in the table without publishing anything.
    const message =
      err instanceof WireDownError
        ? `${err.message} (suggested wait ${err.retryAfterSeconds}s)`
        : (err as Error).message;
    await supabase.from("terminal_posts").insert({
      content: "",
      error: `generation failed: ${message}`,
      pending: false,
    });
    return NextResponse.json({ error: `generation failed: ${message}` }, { status: 500 });
  }

  const estimatedCostUsd = estimateCostUsd(generated.usage);
  await recordSpend(supabase, estimatedCostUsd);

  const { error: insertError } = await supabase.from("terminal_posts").insert({
    content: generated.content,
    clue_tag: generated.clueTag || null,
    input_tokens: generated.usage.input_tokens,
    output_tokens: generated.usage.output_tokens,
    cache_creation_input_tokens: generated.usage.cache_creation_input_tokens,
    cache_read_input_tokens: generated.usage.cache_read_input_tokens,
    estimated_cost_usd: estimatedCostUsd,
    // Held for the owner's accept/edit/trash, exactly like a manually
    // generated one. The scheduled transmission used to go live on insert
    // (migration 016 defaults pending to false and says so), which meant the
    // daily post published itself with nobody having read it. Nothing about
    // this route posts to X — that's manual either way — so the only thing
    // the old behaviour bought was an unreviewed post appearing publicly in
    // [logs] and on the homepage panel. The owner's review card picks this up
    // on their next visit (GenerateTransmission fetches the outstanding
    // pending post on mount), so the scheduled one waits in exactly the same
    // place as a manual one.
    pending: true,
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
