import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isValidSolanaAddress } from "@/lib/solanaAddress";

export const runtime = "nodejs";

// Wallet submissions — docs/VAULT-TROLL-REWARDS.md Path A.
//
// GET returns the signed-in user's own submission (or null). POST files or
// updates it. There is deliberately no DELETE: withdrawing a request the
// operator may already have acted on would make the [inspect] queue lie.
//
// This route NEVER moves a token and never promises one. A submission is a
// request to be considered for a manual airdrop; the operator reviews the
// queue by hand and sends from their own wallet outside this app. No
// PROBLEMS are spent here — that's Path B, a separate system.

async function getUser(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase };
}

export async function GET(request: Request) {
  const auth = await getUser(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("terminal_wallet_submissions")
    .select("address, status, created_at, updated_at")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "could not load your submission" }, { status: 500 });
  }

  // amount_troll and tx_signature are intentionally not selected: they're
  // the operator's private record of a hand-sent transfer, and showing a
  // number back to the user would read as a promise of that number.
  return NextResponse.json({ submission: data ?? null });
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  let body: { address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const address = (body.address ?? "").trim();
  // Revalidated server-side — the client checks the same thing for instant
  // feedback, but its answer is never trusted.
  if (!isValidSolanaAddress(address)) {
    return NextResponse.json({ error: "that isn't a valid solana address" }, { status: 400 });
  }

  // One row per user (unique constraint on user_id). Re-submitting replaces
  // the address rather than queueing a second request.
  //
  // Resubmitting resets status to 'pending' on purpose: if the operator
  // already airdropped this user and they then paste a NEW address, that is
  // a fresh request for consideration, not a silent edit to a settled one.
  // reviewed_at is cleared to match, so the queue never shows a pending row
  // carrying a stale review timestamp.
  const { data, error } = await auth.supabase
    .from("terminal_wallet_submissions")
    .upsert(
      {
        user_id: auth.userId,
        address,
        status: "pending",
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("address, status, created_at, updated_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "could not save your address" }, { status: 500 });
  }

  return NextResponse.json({ submission: data });
}
