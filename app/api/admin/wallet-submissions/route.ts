import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 30;

// Owner-only: the wallet-submission queue behind [inspect]
// (docs/VAULT-TROLL-REWARDS.md Path A). Users file addresses via
// /api/vault/wallet; this is the only way to read the queue back, gated the
// same way every other [inspect] endpoint is.
//
// IMPORTANT: marking a row 'airdropped' RECORDS a transfer the operator
// already made by hand, from their own wallet, outside this app. Nothing in
// this route sends, signs, or holds anything. There are no keys here.

const VALID_STATUSES = ["pending", "airdropped", "skipped"] as const;
type Status = (typeof VALID_STATUSES)[number];

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const { supabase } = owner;

  const { data: rows, error } = await supabase
    .from("terminal_wallet_submissions")
    .select("id, user_id, address, status, amount_troll, tx_signature, note, created_at, updated_at, reviewed_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "could not load submissions" }, { status: 500 });
  }

  const userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));

  // Same two lookups the guesses route does: auth metadata for usernames,
  // terminal_wallets for the activity that makes a row worth judging. A
  // submission with no terminal history at all is the main thing the
  // operator is looking for when deciding what to send.
  let usernameById = new Map<string, string>();
  let activityById = new Map<string, { balance: number; lifetimeEarned: number }>();

  if (userIds.length) {
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    usernameById = new Map(
      (authUsers?.users ?? []).map((u) => [
        u.id,
        (u.user_metadata?.username as string | undefined) ?? "unknown",
      ])
    );

    const { data: wallets } = await supabase
      .from("terminal_wallets")
      .select("user_id, balance, lifetime_earned")
      .in("user_id", userIds);

    activityById = new Map(
      (wallets ?? []).map((w) => [
        w.user_id as string,
        { balance: (w.balance as number) ?? 0, lifetimeEarned: (w.lifetime_earned as number) ?? 0 },
      ])
    );
  }

  return NextResponse.json({
    submissions: (rows ?? []).map((r) => {
      const activity = activityById.get(r.user_id as string);
      return {
        id: r.id,
        username: usernameById.get(r.user_id as string) ?? "unknown",
        address: r.address,
        status: r.status,
        amountTroll: r.amount_troll,
        txSignature: r.tx_signature,
        note: r.note,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        reviewedAt: r.reviewed_at,
        problemsBalance: activity?.balance ?? 0,
        problemsEarned: activity?.lifetimeEarned ?? 0,
      };
    }),
  });
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });
  const { supabase } = owner;

  let body: { id?: string; status?: string; amountTroll?: number | null; txSignature?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing submission id" }, { status: 400 });

  const status = body.status as Status | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const amountRaw = body.amountTroll;
  let amountTroll: number | null = null;
  if (amountRaw !== undefined && amountRaw !== null && `${amountRaw}` !== "") {
    const parsed = Number(amountRaw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }
    amountTroll = parsed;
  }

  const update: Record<string, unknown> = {
    status,
    amount_troll: amountTroll,
    tx_signature: (body.txSignature ?? "").trim() || null,
    note: (body.note ?? "").trim() || null,
    updated_at: new Date().toISOString(),
    // Back to pending means "not reviewed yet" — clear the timestamp so the
    // queue can't show a pending row with a review date on it.
    reviewed_at: status === "pending" ? null : new Date().toISOString(),
  };

  const { error } = await supabase.from("terminal_wallet_submissions").update(update).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "could not update submission" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
