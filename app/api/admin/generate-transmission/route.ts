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
    // Same reason as the cron path: a post still awaiting review might be
    // trashed, so it should not steer the next one.
    .eq("pending", false)
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
      // Held back from [logs] and every other public reader until the owner
      // accepts it in the review prompt. The cron path deliberately does not
      // set this — it runs unattended with nobody there to review.
      pending: true,
    })
    // clue_tag is included so the review prompt can show the owner what the
    // transmission is actually circling before they accept it — the CLUE
    // line is never shown publicly (see lib/persona.ts), only here.
    .select("id, content, clue_tag, x_post_url, art_url, posted_at")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ post });
}

// Accept a transmission from the review prompt — the other half of DELETE
// below. Clears `pending`, which is the only thing keeping the post out of
// [logs], the public /api/posts feed, and the guess/clue surfaces.
export async function PATCH(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_posts")
    .update({ pending: false })
    .eq("id", id)
    .select("id, content, clue_tag, x_post_url, art_url, posted_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "transmission not found" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}

// Discard a transmission the owner rejected in the accept/trash prompt.
//
// The POST above inserts before returning — the post is already public by the
// time it's on screen — so "trash" is a real delete, not a draft that was
// never saved. Deliberately narrow: it only removes a post that was never
// transmitted to X (x_post_url is null), so a rejected draft can go but a
// post already live on someone's timeline can't be erased from here.
//
// The spend it cost is NOT refunded. recordSpend already ran, the tokens were
// really burned, and quietly crediting them back would make the ledger lie
// about what the day actually cost.
export async function DELETE(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_posts")
    .delete()
    .eq("id", id)
    .is("x_post_url", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "not found, or already posted to x" },
      { status: 404 }
    );
  }

  return NextResponse.json({ discarded: data.id });
}
