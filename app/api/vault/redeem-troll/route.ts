import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { checkRedemption, remainingPool, type RoundState } from "@/lib/redemption";

export const runtime = "nodejs";

// PROBLEMS -> $TROLL redemption — docs/VAULT-TROLL-REWARDS.md Path B.
//
// Deliberately NOT part of /api/vault/redeem (the XP path). That route
// debits PROBLEMS and rolls the debit back if the downstream award fails,
// because the award is synchronous. Here the payout is a human sending
// tokens by hand hours or days later, so there is nothing to roll back
// against: the debit lands now and the request sits 'pending' until the
// operator marks it paid or refunds it. Sharing the XP route would make a
// legitimately pending airdrop look identical to a failed redemption.
//
// Nothing in this file moves a token.

type ServiceClient = ReturnType<typeof getServiceClient>;

async function getUser(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase };
}

// The open round plus everything already committed against its pool.
// Refunded requests are excluded: those PROBLEMS went back to the user, so
// the TROLL they would have claimed is available again.
async function loadOpenRound(supabase: ServiceClient): Promise<RoundState | null> {
  const { data: round } = await supabase
    .from("terminal_redemption_rounds")
    .select("id, problems_per_troll, pool_troll, per_user_cap, label")
    .eq("is_open", true)
    .maybeSingle();

  if (!round) return null;

  const { data: committed } = await supabase
    .from("terminal_redemption_requests")
    .select("problems_spent, rate_at_request, amount_troll, status")
    .eq("round_id", round.id)
    .in("status", ["pending", "paid"]);

  const committedTroll = (committed ?? []).reduce((sum, r) => {
    // A paid row's recorded amount is the truth; a pending row is valued at
    // the rate it was filed under.
    const amount =
      r.amount_troll !== null && r.amount_troll !== undefined
        ? Number(r.amount_troll)
        : Number(r.problems_spent) / Number(r.rate_at_request);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  return {
    id: round.id as string,
    problemsPerTroll: Number(round.problems_per_troll),
    poolTroll: Number(round.pool_troll),
    perUserCap: round.per_user_cap === null ? null : Number(round.per_user_cap),
    committedTroll: Math.round(committedTroll * 1e6) / 1e6,
    label: (round.label as string | null) ?? null,
  };
}

async function spentThisRound(
  supabase: ServiceClient,
  roundId: string,
  userId: string
): Promise<number> {
  // Refunded requests don't count against the cap — the user got those
  // PROBLEMS back, so spending them again is not a second bite.
  const { data } = await supabase
    .from("terminal_redemption_requests")
    .select("problems_spent")
    .eq("round_id", roundId)
    .eq("user_id", userId)
    .in("status", ["pending", "paid"]);
  return (data ?? []).reduce((sum, r) => sum + Number(r.problems_spent ?? 0), 0);
}

// GET: what /vault needs to render the panel — the open round, this user's
// allowance within it, and their own request history.
export async function GET(request: Request) {
  const auth = await getUser(request);
  const supabase = auth?.supabase ?? getServiceClient();

  const round = await loadOpenRound(supabase);

  // Signed out: the rate is public, the rest isn't.
  if (!auth) {
    return NextResponse.json({
      round: round
        ? {
            problemsPerTroll: round.problemsPerTroll,
            remainingTroll: remainingPool(round),
            perUserCap: round.perUserCap,
            label: round.label,
          }
        : null,
      requests: [],
      spentThisRound: 0,
    });
  }

  const [{ data: requests }, spent] = await Promise.all([
    supabase
      .from("terminal_redemption_requests")
      .select("id, problems_spent, rate_at_request, status, amount_troll, address, created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    round ? spentThisRound(supabase, round.id, auth.userId) : Promise.resolve(0),
  ]);

  return NextResponse.json({
    round: round
      ? {
          problemsPerTroll: round.problemsPerTroll,
          remainingTroll: remainingPool(round),
          perUserCap: round.perUserCap,
          label: round.label,
        }
      : null,
    requests: requests ?? [],
    spentThisRound: spent,
  });
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { supabase, userId } = auth;

  let body: { problems?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const problems = Math.floor(Number(body.problems));

  const round = await loadOpenRound(supabase);
  if (!round) {
    return NextResponse.json({ error: "no redemption round is open right now" }, { status: 400 });
  }

  // A payout needs somewhere to go. Requiring the Path A submission rather
  // than taking an address here keeps one address per user, already typed
  // and checked, instead of a second place for a typo to cost real tokens.
  const { data: submission } = await supabase
    .from("terminal_wallet_submissions")
    .select("address")
    .eq("user_id", userId)
    .maybeSingle();

  if (!submission?.address) {
    return NextResponse.json(
      { error: "submit a wallet address first — the airdrop needs somewhere to go" },
      { status: 400 }
    );
  }

  const { data: wallet } = await supabase
    .from("terminal_wallets")
    .select("balance, lifetime_spent")
    .eq("user_id", userId)
    .maybeSingle();

  const balance = wallet?.balance ?? 0;
  const alreadySpent = await spentThisRound(supabase, round.id, userId);

  const check = checkRedemption({ problems, balance, round, alreadySpentThisRound: alreadySpent });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 400 });
  }

  // Create the request BEFORE debiting. If the insert fails the user still
  // has their PROBLEMS; if the debit fails we delete the request we just
  // made. The reverse order could leave a debit with nothing recording why.
  const { data: created, error: insertError } = await supabase
    .from("terminal_redemption_requests")
    .insert({
      user_id: userId,
      round_id: round.id,
      problems_spent: problems,
      rate_at_request: round.problemsPerTroll,
      address: submission.address,
      status: "pending",
    })
    .select("id, problems_spent, rate_at_request, status, amount_troll, address, created_at")
    .maybeSingle();

  if (insertError || !created) {
    return NextResponse.json({ error: "could not file your request" }, { status: 500 });
  }

  const newBalance = balance - problems;
  const { error: debitError } = await supabase
    .from("terminal_wallets")
    .update({ balance: newBalance, lifetime_spent: (wallet?.lifetime_spent ?? 0) + problems })
    .eq("user_id", userId)
    // Optimistic concurrency: if the balance moved between the read above
    // and this write (another tab, a chat message landing), the update
    // matches nothing and we unwind rather than overwriting it.
    .eq("balance", balance);

  if (debitError) {
    await supabase.from("terminal_redemption_requests").delete().eq("id", created.id);
    return NextResponse.json({ error: "could not debit your balance" }, { status: 500 });
  }

  // .update() reports no error when zero rows match, so confirm the debit
  // actually landed before leaving a request standing against it.
  const { data: after } = await supabase
    .from("terminal_wallets")
    .select("balance")
    .eq("user_id", userId)
    .maybeSingle();

  if ((after?.balance ?? 0) !== newBalance) {
    await supabase.from("terminal_redemption_requests").delete().eq("id", created.id);
    return NextResponse.json(
      { error: "your balance changed — try that again" },
      { status: 409 }
    );
  }

  await supabase.from("terminal_token_ledger").insert({
    user_id: userId,
    delta: -problems,
    reason: "troll_redemption",
  });

  return NextResponse.json({
    request: created,
    balance: newBalance,
    troll: check.troll,
  });
}
