import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import { generatePost, WireDownError } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";
import { checkAndReserveSpend, recordSpend } from "@/lib/budget";

export const runtime = "nodejs";
export const maxDuration = 60;

type Kind = "clue" | "musing";
const VALID_KINDS: readonly Kind[] = ["clue", "musing"];
function normalizeKind(raw: unknown): Kind {
  return VALID_KINDS.includes(raw as Kind) ? (raw as Kind) : "musing";
}

// A short steering note ("make it darker", "tie it to the bridge") is meant
// as direction for the generator. A finished transmission the owner typed
// themselves reads differently: longer, usually multiple lines, closer to
// prose than a command. Feeding the latter through generatePost as "steer"
// got it paraphrased and stripped of punctuation (apostrophes, quotes) since
// the prompt explicitly tells the model not to quote it — see persona.ts.
// This heuristic routes anything that looks like a real draft straight to
// the database instead, untouched. Multi-line notes are the strongest
// signal: nobody types a multi-line "make it darker."
function isVerbatimSteer(steer: string): boolean {
  if (!steer) return false;
  if (steer.includes("\n")) return true;
  return steer.length >= 120;
}

// Owner-only "generate one right now" button next to the homepage's latest
// transmission panel — same generation path as the scheduled cron
// (/api/admin/generate-transmission) and holds the result for accept/trash —
// nobody but troll_runner ever sees this button.
//
// While a generation is in flight the parent swaps the live transmission text
// for the cryptic waiting animation (onPendingChange), so the panel shows the
// old post dissolving into signal rather than sitting there stale.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_posts")
    .select("id, content, kind, clue_tag, x_post_url, art_url, posted_at, short_answer")
    .eq("pending", true)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data ?? null });
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { supabase } = owner;

  // Steering note from the review card or the chat panel — optional, and a
  // body is not required at all, so a plain click still works.
  let steer = "";
  let replaces = "";
  let answer = "";
  let shortAnswer = false;
  let kind: Kind = "musing";
  try {
    const body = (await request.json()) as {
      steer?: string;
      replaces?: string;
      answer?: string;
      short_answer?: boolean;
      kind?: string;
    };
    // A verbatim paste (see isVerbatimSteer below) is never posted to X as a
    // single tweet the way a generated transmission is, so it isn't held to
    // the 280-char tweet limit — capped generously instead, just to keep the
    // request body sane.
    steer = (body.steer ?? "").trim().slice(0, 5000);
    replaces = (body.replaces ?? "").trim();
    // Hidden clue_tag for a verbatim post only — the generator path already
    // produces its own CLUE line, so this is ignored unless isVerbatimSteer.
    answer = (body.answer ?? "").trim().slice(0, 100);
    shortAnswer = !!body.short_answer;
    // Owner's clue/musing checkbox on the review card (migration 018) —
    // defaults to musing the same way the column itself does.
    kind = normalizeKind(body.kind);
  } catch {
    // no body — a plain generate
  }

  const { data: config } = await supabase
    .from("terminal_config")
    .select("is_paused")
    .single();

  if (config?.is_paused) {
    return NextResponse.json({ error: "the terminal is paused" }, { status: 400 });
  }

  // A steer that reads as a finished transmission rather than a short
  // instruction ("make it darker") is posted exactly as typed instead of
  // being fed to the LLM as "direction" — see isVerbatimSteer's comment.
  // No spend check or provider call needed since nothing gets generated.
  if (isVerbatimSteer(steer)) {
    const content = steer.trim().replace(/\s*[▚▞▓▒]+\s*$/, "").trim();

    const { data: post, error: insertError } = await supabase
      .from("terminal_posts")
      .insert({
        content,
        kind,
        short_answer: shortAnswer,
        clue_tag: answer || null,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        estimated_cost_usd: 0,
        pending: true,
      })
      .select("id, content, kind, clue_tag, x_post_url, art_url, posted_at, short_answer")
      .single();

    if (insertError || !post) {
      return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 });
    }

    if (replaces) {
      const { error: replaceError } = await supabase
        .from("terminal_posts")
        .delete()
        .eq("id", replaces)
        .eq("pending", true)
        .is("x_post_url", null);
      if (replaceError) {
        console.error("[generate-transmission] failed to retire draft:", replaceError.message);
      }
    }

    return NextResponse.json({ post });
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
    .select("content, posted_at, clue_tag")
    .eq("pending", false)
    .order("posted_at", { ascending: false })
    .limit(15);

  const recent = (recentRows ?? []).map((r) => ({
    content: r.content as string,
    posted_at: r.posted_at as string,
    clue_tag: r.clue_tag as string | null,
  }));

  let generated: Awaited<ReturnType<typeof generatePost>>;
  try {
    generated = await generatePost(recent, Date.now(), steer || undefined);
  } catch (err) {
    if (err instanceof WireDownError) {
      return NextResponse.json(
        {
          error: "the wire is quiet — every free provider is down or rate-limited",
          retryAfterSeconds: err.retryAfterSeconds,
        },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      );
    }
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
      kind,
      short_answer: shortAnswer,
      clue_tag: generated.clueTag || null,
      input_tokens: generated.usage.input_tokens,
      output_tokens: generated.usage.output_tokens,
      cache_creation_input_tokens: generated.usage.cache_creation_input_tokens,
      cache_read_input_tokens: generated.usage.cache_read_input_tokens,
      estimated_cost_usd: estimatedCostUsd,
      pending: true,
    })
    .select("id, content, kind, clue_tag, x_post_url, art_url, posted_at, short_answer")
    .single();

  if (insertError || !post) {
    return NextResponse.json({ error: insertError?.message ?? "insert failed" }, { status: 500 });
  }

  if (replaces) {
    const { error: replaceError } = await supabase
      .from("terminal_posts")
      .delete()
      .eq("id", replaces)
      .eq("pending", true)
      .is("x_post_url", null);
    if (replaceError) {
      console.error("[generate-transmission] failed to retire draft:", replaceError.message);
    }
  }

  return NextResponse.json({ post });
}

export async function PATCH(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let body: { id?: string; kind?: string; short_answer?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const kind = normalizeKind(body.kind);
  const shortAnswer = !!body.short_answer;

  const { data, error } = await owner.supabase
    .from("terminal_posts")
    .update({ pending: false, kind, short_answer: shortAnswer })
    .eq("id", id)
    .select("id, content, kind, clue_tag, x_post_url, art_url, posted_at, short_answer")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "transmission not found" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}

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
