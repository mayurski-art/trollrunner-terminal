import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// 1 PROBLEM = 25 XP. Kept in sync with the multiplier baked into
// troll_award_xp_internal's problems_redeemed case (see
// assets/supabase/troll_terminal_xp_redeem.sql in the main site repo) —
// that function recomputes XP from problemsSpent itself rather than
// trusting any number this route sends, so this constant is only ever
// used here to show the preview and to debit the right amount up front.
const XP_PER_PROBLEM = 25;
const MIN_REDEEM = 5;

// Redeem PROBLEMS (trollrunner-terminal's own currency) for real, shared
// XP. Debits terminal_wallets first — a table this project owns — then
// calls the main site's troll_award_xp_service RPC to credit XP. If the XP
// award fails, the debit is rolled back so a PROBLEMS spend never vanishes
// without anything to show for it.
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const userId = userData.user.id;

  let body: { amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const amount = Math.floor(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount < MIN_REDEEM) {
    return NextResponse.json(
      { error: `redeem at least ${MIN_REDEEM} PROBLEMS at a time` },
      { status: 400 }
    );
  }

  const { data: wallet } = await supabase
    .from("terminal_wallets")
    .select("balance, lifetime_spent")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = wallet?.balance ?? 0;
  if (balance < amount) {
    return NextResponse.json(
      { error: `not enough PROBLEMS — need ${amount}, have ${balance}` },
      { status: 400 }
    );
  }

  const newBalance = balance - amount;
  const { error: debitError } = await supabase
    .from("terminal_wallets")
    .update({ balance: newBalance, lifetime_spent: (wallet?.lifetime_spent ?? 0) + amount })
    .eq("user_id", userId);
  if (debitError) {
    return NextResponse.json({ error: "could not debit balance" }, { status: 500 });
  }

  const { data: xpResult, error: xpError } = await supabase.rpc("troll_award_xp_service", {
    p_user_id: userId,
    p_event: "problems_redeemed",
    p_source: "terminal_vault",
    p_meta: { problemsSpent: amount },
  });

  if (xpError || !xpResult?.awarded) {
    // Roll back the debit — the spend never landed anywhere.
    await supabase
      .from("terminal_wallets")
      .update({ balance, lifetime_spent: wallet?.lifetime_spent ?? 0 })
      .eq("user_id", userId);
    return NextResponse.json(
      { error: xpError?.message ?? "xp award failed — balance restored" },
      { status: 500 }
    );
  }

  await supabase.from("terminal_token_ledger").insert({
    user_id: userId,
    delta: -amount,
    reason: "xp_redeemed",
  });

  return NextResponse.json({
    problemsSpent: amount,
    xpAwarded: xpResult.awarded,
    xpTotal: xpResult.xp,
    level: xpResult.level,
    balance: newBalance,
  });
}
