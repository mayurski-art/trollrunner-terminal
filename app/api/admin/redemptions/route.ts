import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import { trollForProblems } from "@/lib/redemption";

export const runtime = "nodejs";
export const maxDuration = 30;

// Owner-only: redemption rounds and the request queue behind [inspect]
// (docs/VAULT-TROLL-REWARDS.md Path B, §4.3).
//
// Marking a request 'paid' RECORDS a transfer the operator already made by
// hand from their own wallet. Nothing here sends, signs, or holds anything.
//
// Refunding returns the PROBLEMS the user spent (§4.4) — the manual
// counterpart to the synchronous rollback the XP route gets for free.

type Action = "open_round" | "close_round" | "pay" | "refund" | "unreview";

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const { supabase } = owner;

  const [{ data: rounds }, { data: requests }] = await Promise.all([
    supabase
      .from("terminal_redemption_rounds")
      .select("id, problems_per_troll, pool_troll, per_user_cap, is_open, label, created_at, closed_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("terminal_redemption_requests")
      .select("id, user_id, round_id, problems_spent, rate_at_request, address, status, amount_troll, tx_signature, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const userIds = Array.from(new Set((requests ?? []).map((r) => r.user_id as string)));
  let usernameById = new Map<string, string>();
  if (userIds.length) {
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    usernameById = new Map(
      (authUsers?.users ?? []).map((u) => [
        u.id,
        (u.user_metadata?.username as string | undefined) ?? "unknown",
      ])
    );
  }

  // Per-round committed totals, so the operator can see how much of each
  // pool is spoken for without adding it up by hand.
  const committedByRound = new Map<string, number>();
  for (const r of requests ?? []) {
    if (r.status === "refunded") continue;
    const amount =
      r.amount_troll !== null && r.amount_troll !== undefined
        ? Number(r.amount_troll)
        : trollForProblems(Number(r.problems_spent), Number(r.rate_at_request));
    const key = r.round_id as string;
    committedByRound.set(key, (committedByRound.get(key) ?? 0) + amount);
  }

  return NextResponse.json({
    rounds: (rounds ?? []).map((r) => ({
      id: r.id,
      problemsPerTroll: Number(r.problems_per_troll),
      poolTroll: Number(r.pool_troll),
      perUserCap: r.per_user_cap === null ? null : Number(r.per_user_cap),
      isOpen: r.is_open,
      label: r.label,
      createdAt: r.created_at,
      closedAt: r.closed_at,
      committedTroll: Math.round((committedByRound.get(r.id as string) ?? 0) * 1e6) / 1e6,
    })),
    requests: (requests ?? []).map((r) => ({
      id: r.id,
      username: usernameById.get(r.user_id as string) ?? "unknown",
      problemsSpent: Number(r.problems_spent),
      rateAtRequest: Number(r.rate_at_request),
      owedTroll: trollForProblems(Number(r.problems_spent), Number(r.rate_at_request)),
      address: r.address,
      status: r.status,
      amountTroll: r.amount_troll === null ? null : Number(r.amount_troll),
      txSignature: r.tx_signature,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const { supabase } = owner;

  let body: {
    action?: string;
    id?: string;
    problemsPerTroll?: number;
    poolTroll?: number;
    perUserCap?: number | null;
    label?: string;
    amountTroll?: number | null;
    txSignature?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const action = body.action as Action | undefined;

  if (action === "open_round") {
    const rate = Number(body.problemsPerTroll);
    const pool = Number(body.poolTroll);
    if (!Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: "rate must be a positive number" }, { status: 400 });
    }
    if (!Number.isFinite(pool) || pool < 0) {
      return NextResponse.json({ error: "pool must be zero or more" }, { status: 400 });
    }
    const cap =
      body.perUserCap === null || body.perUserCap === undefined || `${body.perUserCap}` === ""
        ? null
        : Math.floor(Number(body.perUserCap));
    if (cap !== null && (!Number.isFinite(cap) || cap <= 0)) {
      return NextResponse.json({ error: "cap must be a positive whole number" }, { status: 400 });
    }

    // One open round at a time — the database enforces this too (partial
    // unique index), so close the current one first rather than relying on
    // the operator to remember.
    await supabase
      .from("terminal_redemption_rounds")
      .update({ is_open: false, closed_at: new Date().toISOString() })
      .eq("is_open", true);

    const { error } = await supabase.from("terminal_redemption_rounds").insert({
      problems_per_troll: rate,
      pool_troll: pool,
      per_user_cap: cap,
      label: (body.label ?? "").trim() || null,
      is_open: true,
    });
    if (error) return NextResponse.json({ error: "could not open the round" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "close_round") {
    const { error } = await supabase
      .from("terminal_redemption_rounds")
      .update({ is_open: false, closed_at: new Date().toISOString() })
      .eq("is_open", true);
    if (error) return NextResponse.json({ error: "could not close the round" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing request id" }, { status: 400 });

  const { data: req } = await supabase
    .from("terminal_redemption_requests")
    .select("id, user_id, problems_spent, rate_at_request, status")
    .eq("id", id)
    .maybeSingle();

  if (!req) return NextResponse.json({ error: "no such request" }, { status: 404 });

  if (action === "pay") {
    if (req.status === "refunded") {
      return NextResponse.json(
        { error: "that one was refunded — the PROBLEMS are already back" },
        { status: 400 }
      );
    }
    const amount =
      body.amountTroll === null || body.amountTroll === undefined || `${body.amountTroll}` === ""
        ? trollForProblems(Number(req.problems_spent), Number(req.rate_at_request))
        : Number(body.amountTroll);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const { error } = await supabase
      .from("terminal_redemption_requests")
      .update({
        status: "paid",
        amount_troll: amount,
        tx_signature: (body.txSignature ?? "").trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "could not record payment" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "refund") {
    if (req.status === "refunded") {
      return NextResponse.json({ error: "already refunded" }, { status: 400 });
    }
    // Refusing to refund a PAID request is the important guard here: the
    // TROLL is already gone from the operator's wallet, so returning the
    // PROBLEMS too would pay for the same request twice. The UI only offers
    // refund on pending rows, but this route can't depend on that. Undo the
    // payment first if it was marked in error.
    if (req.status === "paid") {
      return NextResponse.json(
        { error: "that one is marked paid — undo the payment first if it was a mistake" },
        { status: 400 }
      );
    }

    // Give the PROBLEMS back, then mark the row. Marking first would risk
    // a row that claims to be refunded while the balance never moved.
    const { data: wallet } = await supabase
      .from("terminal_wallets")
      .select("balance, lifetime_spent")
      .eq("user_id", req.user_id as string)
      .maybeSingle();

    const spent = Number(req.problems_spent);
    const { error: creditError } = await supabase
      .from("terminal_wallets")
      .upsert({
        user_id: req.user_id as string,
        balance: (wallet?.balance ?? 0) + spent,
        lifetime_spent: Math.max(0, (wallet?.lifetime_spent ?? 0) - spent),
      });
    if (creditError) {
      return NextResponse.json({ error: "could not return the PROBLEMS" }, { status: 500 });
    }

    const { error } = await supabase
      .from("terminal_redemption_requests")
      .update({
        status: "refunded",
        amount_troll: null,
        tx_signature: null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      // The credit landed; leaving the row un-marked is the safe failure —
      // it shows as still pending rather than silently losing the refund.
      return NextResponse.json(
        { error: "PROBLEMS returned but the row didn't update — refresh" },
        { status: 500 }
      );
    }

    await supabase.from("terminal_token_ledger").insert({
      user_id: req.user_id as string,
      delta: spent,
      reason: "troll_redemption_refund",
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "unreview") {
    // Undo a 'paid' mark only. A refund already moved PROBLEMS back, so
    // un-refunding would have to debit them again — that's a new request,
    // not an undo.
    if (req.status === "refunded") {
      return NextResponse.json(
        { error: "can't undo a refund — the PROBLEMS are back with the user" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("terminal_redemption_requests")
      .update({ status: "pending", amount_troll: null, tx_signature: null, reviewed_at: null })
      .eq("id", id);
    if (error) return NextResponse.json({ error: "could not undo" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
