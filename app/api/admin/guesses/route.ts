import { NextResponse } from "next/server";
import { requireOwner, OWNER_USERNAME } from "@/lib/admin";
import { CORRECT_BONUS } from "@/lib/musingGuess";

export const runtime = "nodejs";

// Owner-only: powers the [ review ] page — every resolved-but-wrong guess
// against a transmission, so the owner can eyeball ones gradeGuess() denied
// that were actually close enough, and flip them by hand.
//
// terminal_post_guesses has RLS with only an "own rows" select policy, so
// this always goes through the service-role client requireOwner() hands
// back — same trust model as app/api/admin/transmissions.

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_post_guesses")
    .select(
      "id, post_id, user_id, last_guess_text, attempts, correct, resolved, cost_paid, overridden_by, created_at, resolved_at, terminal_posts(clue_tag, content)"
    )
    .eq("resolved", true)
    .order("resolved_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guesses: data ?? [] });
}

// One action: flip a resolved-incorrect guess to correct and pay out the
// same refund + bonus the auto-grader would have on a genuine correct
// guess. Only ever moves incorrect -> correct — there's no path back, since
// undoing a payout means clawing back PROBLEMS the user may have already
// spent, which this endpoint isn't built to reconcile.
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed request" }, { status: 400 });
  }

  const { id } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing guess id" }, { status: 400 });
  }

  const { data: guess, error: fetchError } = await owner.supabase
    .from("terminal_post_guesses")
    .select("id, user_id, correct, resolved, cost_paid")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!guess) {
    return NextResponse.json({ error: "no such guess" }, { status: 404 });
  }
  if (!guess.resolved) {
    return NextResponse.json({ error: "not resolved yet" }, { status: 400 });
  }
  if (guess.correct) {
    return NextResponse.json({ error: "already marked correct" }, { status: 400 });
  }

  const { data: wallet } = await owner.supabase
    .from("terminal_wallets")
    .select("balance")
    .eq("user_id", guess.user_id)
    .maybeSingle();

  const payout = guess.cost_paid + CORRECT_BONUS;
  const newBalance = (wallet?.balance ?? 0) + payout;

  await owner.supabase
    .from("terminal_wallets")
    .upsert({ user_id: guess.user_id, balance: newBalance });

  await owner.supabase.from("terminal_token_ledger").insert({
    user_id: guess.user_id,
    delta: payout,
    reason: "post_guess_override",
  });

  const { data: updated, error: updateError } = await owner.supabase
    .from("terminal_post_guesses")
    .update({ correct: true, overridden_by: OWNER_USERNAME })
    .eq("id", id)
    .select(
      "id, post_id, user_id, last_guess_text, attempts, correct, resolved, cost_paid, overridden_by, created_at, resolved_at"
    )
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ guess: updated });
}
