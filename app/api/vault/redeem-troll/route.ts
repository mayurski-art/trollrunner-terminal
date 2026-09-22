import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { remainingPool, type RoundState } from "@/lib/redemption";

export const runtime = "nodejs";

// The redemption rate/history display on /vault — docs/VAULT-TROLL-REWARDS.md
// Path B. Filing new requests (the old POST handler) was torn out along with
// the redeem form and its [inspect] review panel; this route is now
// read-only, showing the open round's rate and this user's past requests.
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

// GET: what /vault needs to render the panel — the open round and this
// user's own request history.
export async function GET(request: Request) {
  const auth = await getUser(request);
  const supabase = auth?.supabase ?? getServiceClient();

  const round = await loadOpenRound(supabase);
  const roundOut = round
    ? {
        problemsPerTroll: round.problemsPerTroll,
        remainingTroll: remainingPool(round),
        perUserCap: round.perUserCap,
        label: round.label,
      }
    : null;

  // Signed out: the rate is public, the rest isn't.
  if (!auth) {
    return NextResponse.json({ round: roundOut, requests: [] });
  }

  const { data: requests } = await supabase
    .from("terminal_redemption_requests")
    .select("id, problems_spent, rate_at_request, status, amount_troll, address, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ round: roundOut, requests: requests ?? [] });
}
