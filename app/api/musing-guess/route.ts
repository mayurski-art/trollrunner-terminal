import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { gradeGuess, GUESS_COST, MAX_ATTEMPTS, CORRECT_BONUS } from "@/lib/musingGuess";

export const runtime = "nodejs";

type Wallet = { balance: number };

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

async function loadWallet(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<Wallet> {
  const { data } = await supabase
    .from("terminal_wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();
  return { balance: data?.balance ?? 0 };
}

async function applyWalletDelta(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  wallet: Wallet,
  delta: number,
  reason: string
): Promise<number> {
  const newBalance = Math.max(0, wallet.balance + delta);
  const actualDelta = newBalance - wallet.balance;

  await supabase.from("terminal_wallets").upsert({ user_id: userId, balance: newBalance });

  if (actualDelta !== 0) {
    await supabase
      .from("terminal_token_ledger")
      .insert({ user_id: userId, delta: actualDelta, reason });
  }

  return newBalance;
}

// Read-only: current guess state for this musing/user, plus whether it's
// guessable at all (older musings predate answer_tag and never will be).
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { supabase, userId } = auth;

  const { searchParams } = new URL(request.url);
  const musingId = searchParams.get("musingId");
  if (!musingId) return NextResponse.json({ error: "missing musingId" }, { status: 400 });

  const [{ data: musing }, { data: guess }, wallet] = await Promise.all([
    supabase.from("terminal_musings").select("answer_tag").eq("id", musingId).maybeSingle(),
    supabase
      .from("terminal_musing_guesses")
      .select("attempts, correct, resolved")
      .eq("musing_id", musingId)
      .eq("user_id", userId)
      .maybeSingle(),
    loadWallet(supabase, userId),
  ]);

  return NextResponse.json({
    guessable: !!musing?.answer_tag,
    guess: guess ?? null,
    wallet,
    cost: GUESS_COST,
    maxAttempts: MAX_ATTEMPTS,
  });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { supabase, userId } = auth;

  let body: { musingId?: string; guess?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const musingId = body.musingId;
  const guessText = (body.guess ?? "").trim();
  if (!musingId) return NextResponse.json({ error: "missing musingId" }, { status: 400 });
  if (!guessText) return NextResponse.json({ error: "empty guess" }, { status: 400 });
  if (guessText.length > 200) {
    return NextResponse.json({ error: "keep it under 200 characters" }, { status: 400 });
  }

  const { data: musing } = await supabase
    .from("terminal_musings")
    .select("id, answer_tag")
    .eq("id", musingId)
    .maybeSingle();

  if (!musing?.answer_tag) {
    return NextResponse.json({ error: "this transmission can't be answered" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("terminal_musing_guesses")
    .select("id, attempts, correct, resolved, cost_paid")
    .eq("musing_id", musingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.resolved) {
    return NextResponse.json({ error: "already resolved for this transmission" }, { status: 400 });
  }

  const wallet = await loadWallet(supabase, userId);

  let guessRow = existing;
  if (!guessRow) {
    if (wallet.balance < GUESS_COST) {
      return NextResponse.json(
        { error: `not enough PROBLEMS — need ${GUESS_COST}, have ${wallet.balance}` },
        { status: 400 }
      );
    }
    await applyWalletDelta(supabase, userId, wallet, -GUESS_COST, "musing_guess_spend");
    wallet.balance -= GUESS_COST;

    const { data: inserted, error: insertError } = await supabase
      .from("terminal_musing_guesses")
      .insert({ musing_id: musingId, user_id: userId, cost_paid: GUESS_COST })
      .select("id, attempts, correct, resolved, cost_paid")
      .single();

    if (insertError || !inserted) {
      // Refund immediately if the row failed to create — the spend already
      // happened, don't leave the user's PROBLEMS stranded.
      await applyWalletDelta(supabase, userId, wallet, GUESS_COST, "musing_guess_refund");
      return NextResponse.json({ error: "could not open a guess" }, { status: 500 });
    }
    guessRow = inserted;
  }

  const correct = gradeGuess(guessText, musing.answer_tag);
  const attempts = guessRow.attempts + 1;
  const resolved = correct || attempts >= MAX_ATTEMPTS;

  let newBalance = wallet.balance;
  if (correct) {
    newBalance = await applyWalletDelta(
      supabase,
      userId,
      wallet,
      guessRow.cost_paid + CORRECT_BONUS,
      "musing_guess_correct"
    );
  }

  await supabase
    .from("terminal_musing_guesses")
    .update({
      attempts,
      correct,
      resolved,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", guessRow.id);

  return NextResponse.json({
    correct,
    attempts,
    attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts),
    resolved,
    wallet: { balance: newBalance },
  });
}
