"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import { getPublicClient } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import Meter from "@/components/Meter";
import Faq from "@/components/Faq";
import { BANNER_VAULT } from "@/lib/ascii";
import { describeAddressProblem, isValidSolanaAddress, shortenAddress } from "@/lib/solanaAddress";
import {
  MIN_REDEEM_PROBLEMS,
  checkRedemption,
  problemsForOneTroll,
  trollForProblems,
} from "@/lib/redemption";

type Wallet = {
  balance: number;
  lifetime_earned: number;
  qualifying_count: number;
};

type LedgerRow = { id: string; delta: number; reason: string; created_at: string };
type LadderRow = { user_id: string; balance: number; username: string | null };
type WalletSubmission = {
  address: string;
  status: "pending" | "airdropped" | "skipped";
  created_at: string;
  updated_at: string;
};

type OpenRound = {
  problemsPerTroll: number;
  remainingTroll: number;
  perUserCap: number | null;
  label: string | null;
};

type RedemptionRequest = {
  id: string;
  problems_spent: number;
  rate_at_request: number;
  status: "pending" | "paid" | "refunded";
  amount_troll: number | null;
  created_at: string;
};

const QUALIFYING_INTERVAL = 7;
const XP_PER_PROBLEM = 25;
const MIN_REDEEM = 5;

// The $TROLL airdrop line is no longer locked — it's the wallet-submission
// form below (docs/VAULT-TROLL-REWARDS.md Path A).
const LOCKED_ITEMS = [
  { cost: null, label: "cosmetic profile unlock" },
  { cost: null, label: "leaderboard crown" },
  { cost: null, label: "something it won't describe yet" },
];

export default function VaultPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ladder, setLadder] = useState<LadderRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<{ xpAwarded: number; level: number } | null>(
    null
  );
  const [submission, setSubmission] = useState<WalletSubmission | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [addressBusy, setAddressBusy] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressSaved, setAddressSaved] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [round, setRound] = useState<OpenRound | null>(null);
  const [requests, setRequests] = useState<RedemptionRequest[]>([]);
  const [spentThisRound, setSpentThisRound] = useState(0);
  const [trollInput, setTrollInput] = useState("");
  const [trollBusy, setTrollBusy] = useState(false);
  const [trollError, setTrollError] = useState<string | null>(null);
  const [trollFiled, setTrollFiled] = useState(false);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let sb: ReturnType<typeof getPublicClient>;
    try {
      sb = getPublicClient();
    } catch (err) {
      console.error("[vault] Supabase client unavailable:", err);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadError("Supabase client unavailable — check env vars.");
      return;
    }

    // Balance ticks up from chatting on a different page (or tab), so a
    // one-shot fetch on mount goes stale the moment you leave it open —
    // refetch whenever this tab becomes visible again, not just once.
    // Every query is awaited with its error checked and logged — a swallowed
    // {error} used to leave the page silently stuck showing nothing.
    async function load() {
      if (!cancelled) setLoadError(null);
      try {
        const { data: ladderData, error: ladderError } = await sb!
          .from("terminal_wallets")
          .select("user_id, balance")
          .order("balance", { ascending: false })
          .limit(10);
        if (ladderError) throw ladderError;

        // terminal_wallets has no FK to troll_profiles (both just reference
        // auth.users independently), so PostgREST can't embed the username —
        // fetch it in a second, separate query and merge client-side.
        const ids = (ladderData ?? []).map((row) => row.user_id);
        let usernames = new Map<string, string>();
        if (ids.length > 0) {
          const { data: profileRows, error: profileError } = await sb!
            .from("troll_profiles")
            .select("id, username")
            .in("id", ids);
          if (profileError) throw profileError;
          usernames = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
        }
        if (!cancelled) {
          setLadder(
            (ladderData ?? []).map((row) => ({
              ...row,
              username: usernames.get(row.user_id) ?? null,
            }))
          );
        }

        if (session) {
          const { data: walletData, error: walletError } = await sb!
            .from("terminal_wallets")
            .select("balance, lifetime_earned, qualifying_count")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (walletError) throw walletError;
          if (!cancelled) {
            setWallet(walletData ?? { balance: 0, lifetime_earned: 0, qualifying_count: 0 });
          }

          const { data: ledgerData, error: ledgerError } = await sb!
            .from("terminal_token_ledger")
            .select("id, delta, reason, created_at")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false })
            .limit(20);
          if (ledgerError) throw ledgerError;
          if (!cancelled) setLedger(ledgerData ?? []);
        }
      } catch (err) {
        console.error("[vault] failed to load wallet data:", err);
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load your balance.");
        }
      }
    }

    load();
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [session]);

  // The wallet submission is read through the API rather than the public
  // client: RLS would allow a direct select, but the route already shapes
  // the response and deliberately withholds the operator's private payout
  // record (amount, signature) from the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Signed out: clear whatever the previous session left on screen. Done
      // inside the async body so the effect never calls setState
      // synchronously during render.
      if (!session) {
        if (!cancelled) setSubmission(null);
        return;
      }
      try {
        const { data } = await getPublicClient().auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/vault/wallet", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const result = await res.json();
        if (!cancelled) setSubmission(result.submission ?? null);
      } catch {
        // Non-fatal: the form still works, it just won't prefill.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session]);

  // The open round is public (signed-out visitors see the rate); the
  // request list and this user's spend are not.
  const loadRedemption = useCallback(async () => {
    try {
      const { data } = await getPublicClient().auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/vault/redeem-troll", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const result = await res.json();
      setRound(result.round ?? null);
      setRequests(result.requests ?? []);
      setSpentThisRound(result.spentThisRound ?? 0);
    } catch {
      // Non-fatal — the rest of the vault still renders.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await loadRedemption();
    })();
    return () => {
      cancelled = true;
    };
  }, [session, loadRedemption]);

  async function redeemForTroll() {
    const problems = Math.floor(Number(trollInput));
    if (trollBusy || !session || !round) return;
    setTrollBusy(true);
    setTrollError(null);
    setTrollFiled(false);
    try {
      const { data } = await getPublicClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setTrollError("sign in required");
        return;
      }
      const res = await fetch("/api/vault/redeem-troll", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ problems }),
      });
      const result = await res.json();
      if (!res.ok) {
        setTrollError(result.error ?? "could not file your request");
        return;
      }
      setWallet((w) => (w ? { ...w, balance: result.balance } : w));
      setTrollInput("");
      setTrollFiled(true);
      await loadRedemption();
    } catch {
      setTrollError("connection to the terminal was lost");
    } finally {
      setTrollBusy(false);
    }
  }

  async function saveAddress() {
    const address = addressInput.trim();
    if (addressBusy || !session) return;
    const problem = describeAddressProblem(address);
    if (problem) {
      setAddressError(problem);
      return;
    }
    setAddressBusy(true);
    setAddressError(null);
    setAddressSaved(false);
    try {
      const { data } = await getPublicClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setAddressError("sign in required");
        return;
      }
      const res = await fetch("/api/vault/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAddressError(result.error ?? "could not save your address");
        return;
      }
      setSubmission(result.submission ?? null);
      setAddressInput("");
      setAddressSaved(true);
      setEditingAddress(false);
    } catch {
      setAddressError("connection to the terminal was lost");
    } finally {
      setAddressBusy(false);
    }
  }

  async function redeem() {
    const amount = Math.floor(Number(redeemInput));
    if (redeemBusy || !session || !Number.isFinite(amount) || amount < MIN_REDEEM) return;
    setRedeemBusy(true);
    setRedeemError(null);
    setRedeemResult(null);
    try {
      const { data } = await getPublicClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setRedeemError("sign in required");
        return;
      }
      const res = await fetch("/api/vault/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount }),
      });
      const result = await res.json();
      if (!res.ok) {
        setRedeemError(result.error ?? "redemption failed");
        return;
      }
      setWallet((w) => (w ? { ...w, balance: result.balance } : w));
      setRedeemResult({ xpAwarded: result.xpAwarded, level: result.level });
      setRedeemInput("");
    } catch {
      setRedeemError("connection to the terminal was lost");
    } finally {
      setRedeemBusy(false);
    }
  }

  const redeemAmount = Math.floor(Number(redeemInput));
  const redeemValid = Number.isFinite(redeemAmount) && redeemAmount >= MIN_REDEEM;

  // Same rule set the server enforces (lib/redemption.ts), so the form can
  // never invite a spend the route will refuse.
  const trollAmount = Math.floor(Number(trollInput));
  const trollCheck =
    round && trollInput.trim() !== ""
      ? checkRedemption({
          problems: trollAmount,
          balance: wallet?.balance ?? 0,
          round: {
            id: "",
            problemsPerTroll: round.problemsPerTroll,
            poolTroll: round.remainingTroll,
            perUserCap: round.perUserCap,
            committedTroll: 0,
            label: round.label,
          },
          alreadySpentThisRound: spentThisRound,
        })
      : null;
  const hasAddress = Boolean(submission?.address);
  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg vault-hero-bg" />
      </div>
      <div className="w-full max-w-3xl vault-content">
        <Nav />
        <Banner art={BANNER_VAULT} label="the vault" tone="alert" />
        <p className="text-dim text-sm mb-8">
          your signal balance · xp redemption live, more protocols coming
        </p>

        {session ? (
          <>
            {loadError && (
              <p className="text-alert text-xs mb-3">[ {loadError} ]</p>
            )}
            <Frame title="your signal" tone="problem" className="mb-6">
              <p className="text-4xl text-problem mb-3">{wallet?.balance ?? "..."}</p>
              <p className="text-dim text-xs mb-3">
                lifetime mined: {wallet?.lifetime_earned ?? 0}
              </p>
              <Meter
                width={10}
                fraction={(wallet?.qualifying_count ?? 0) / QUALIFYING_INTERVAL}
                tone="problem"
                label={`mining progress: ${wallet?.qualifying_count ?? 0}/${QUALIFYING_INTERVAL}`}
              />
            </Frame>

            <Frame title="redeem for xp" tone="dim" className="mb-6">
              <p className="text-dim text-xs mb-3">
                1 PROBLEM = {XP_PER_PROBLEM} XP, one-way, minimum {MIN_REDEEM} at a time.
              </p>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={MIN_REDEEM}
                  step={1}
                  value={redeemInput}
                  onChange={(e) => {
                    setRedeemInput(e.target.value);
                    setRedeemResult(null);
                    setRedeemError(null);
                  }}
                  placeholder={`${MIN_REDEEM}+`}
                  disabled={redeemBusy}
                  className="w-28 bg-transparent border border-dim px-2 py-1 text-sm text-problem outline-none focus:border-problem disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={redeem}
                  disabled={redeemBusy || !redeemValid || redeemAmount > (wallet?.balance ?? 0)}
                  className="border border-terminal text-terminal px-3 text-xs hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
                >
                  {redeemBusy ? "..." : "redeem"}
                </button>
              </div>
              {redeemValid && (
                <p className="text-dim text-xs mt-2">
                  → {redeemAmount * XP_PER_PROBLEM} xp
                  {redeemAmount > (wallet?.balance ?? 0) && (
                    <span className="text-alert"> · not enough PROBLEMS</span>
                  )}
                </p>
              )}
              {redeemError && <p className="text-alert text-xs mt-2">[ {redeemError} ]</p>}
              {redeemResult && (
                <p className="text-terminal text-xs mt-2">
                  [ +{redeemResult.xpAwarded} xp — now level {redeemResult.level} ]
                </p>
              )}
            </Frame>

            <Frame title="$troll airdrop — submit a wallet" tone="dim" className="mb-6">
              {submission && !editingAddress ? (
                <>
                  <p className="text-dim text-xs mb-2">you&apos;re in the queue.</p>
                  <p className="text-problem text-sm font-mono break-all mb-2">
                    {shortenAddress(submission.address, 6, 6)}
                  </p>
                  <p className="text-dim text-xs mb-3">
                    status:{" "}
                    {submission.status === "pending" && (
                      <span className="text-problem">waiting on review</span>
                    )}
                    {submission.status === "airdropped" && (
                      <span className="text-gain">airdropped</span>
                    )}
                    {submission.status === "skipped" && (
                      <span className="text-ghost">not this time</span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddress(true);
                      setAddressInput(submission.address);
                      setAddressSaved(false);
                      setAddressError(null);
                    }}
                    className="border border-dim text-dim px-3 py-1 text-xs hover:border-terminal hover:text-terminal transition-colors"
                  >
                    change address
                  </button>
                </>
              ) : (
                <>
                  <p className="text-dim text-xs mb-3">
                    paste a solana address to be considered for a $TROLL airdrop. reviewed by
                    hand — this is a request, not a claim.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={addressInput}
                      onChange={(e) => {
                        setAddressInput(e.target.value);
                        setAddressError(null);
                        setAddressSaved(false);
                      }}
                      placeholder="your solana address"
                      spellCheck={false}
                      autoComplete="off"
                      disabled={addressBusy}
                      className="flex-1 min-w-0 bg-transparent border border-dim px-2 py-1 text-sm text-problem font-mono outline-none focus:border-problem disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={saveAddress}
                      disabled={addressBusy || !isValidSolanaAddress(addressInput)}
                      className="shrink-0 border border-terminal text-terminal px-3 text-xs hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
                    >
                      {addressBusy ? "..." : "submit"}
                    </button>
                  </div>
                  {editingAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAddress(false);
                        setAddressInput("");
                        setAddressError(null);
                      }}
                      className="text-ghost text-xs mt-2 hover:text-dim transition-colors"
                    >
                      cancel
                    </button>
                  )}
                  {addressError && <p className="text-alert text-xs mt-2">[ {addressError} ]</p>}
                </>
              )}
              {addressSaved && (
                <p className="text-terminal text-xs mt-2">
                  [ submitted — the operator reviews these by hand. no promises. ]
                </p>
              )}
              <p className="text-ghost text-xs mt-3">
                double-check it. an airdrop sent to a wrong address is gone.
              </p>
            </Frame>

            <Frame title="redeem problems for $troll" tone="dim" className="mb-6">
              {!round ? (
                <p className="text-dim text-xs">
                  no redemption round is open right now. the terminal opens them when the pool
                  has something in it.
                </p>
              ) : (
                <>
                  <p className="text-dim text-xs mb-1">
                    this round: <span className="text-problem">{round.problemsPerTroll}</span>{" "}
                    PROBLEMS = 1 $TROLL
                    {round.label && <span className="text-ghost"> · {round.label}</span>}
                  </p>
                  <p className="text-ghost text-xs mb-3">
                    {round.remainingTroll} $TROLL left in this round
                    {round.perUserCap !== null && (
                      <>
                        {" "}
                        · your cap: {spentThisRound}/{round.perUserCap} PROBLEMS used
                      </>
                    )}
                  </p>

                  {!hasAddress ? (
                    <p className="text-alert text-xs">
                      [ submit a wallet address above first — the airdrop needs somewhere to go ]
                    </p>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={MIN_REDEEM_PROBLEMS}
                          step={1}
                          value={trollInput}
                          onChange={(e) => {
                            setTrollInput(e.target.value);
                            setTrollError(null);
                            setTrollFiled(false);
                          }}
                          placeholder={`${MIN_REDEEM_PROBLEMS}+`}
                          disabled={trollBusy}
                          className="w-28 bg-transparent border border-dim px-2 py-1 text-sm text-problem outline-none focus:border-problem disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={redeemForTroll}
                          disabled={trollBusy || !trollCheck?.ok}
                          className="border border-terminal text-terminal px-3 text-xs hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
                        >
                          {trollBusy ? "..." : "request"}
                        </button>
                      </div>

                      {trollCheck?.ok && (
                        <p className="text-dim text-xs mt-2">
                          → {trollCheck.troll} $TROLL, pending review
                        </p>
                      )}
                      {trollCheck && !trollCheck.ok && (
                        <p className="text-alert text-xs mt-2">[ {trollCheck.error} ]</p>
                      )}
                      {!trollInput.trim() && (
                        <p className="text-ghost text-xs mt-2">
                          {problemsForOneTroll(round.problemsPerTroll)} PROBLEMS gets you a whole
                          coin.
                        </p>
                      )}
                      {trollError && <p className="text-alert text-xs mt-2">[ {trollError} ]</p>}
                      {trollFiled && (
                        <p className="text-terminal text-xs mt-2">
                          [ filed — your PROBLEMS are spent. the operator sends these by hand. ]
                        </p>
                      )}
                    </>
                  )}

                  <p className="text-ghost text-xs mt-3">
                    rate applies to this round only and can change in the next one.
                  </p>
                </>
              )}

              {requests.length > 0 && (
                <ul className="mt-4 space-y-1 text-xs border-t border-dim pt-3">
                  {requests.slice(0, 6).map((r) => (
                    <li key={r.id} className="flex justify-between gap-3 text-dim">
                      <span>
                        {r.problems_spent} PROBLEMS →{" "}
                        {r.amount_troll ??
                          trollForProblems(r.problems_spent, r.rate_at_request)}{" "}
                        $TROLL
                      </span>
                      <span className="shrink-0">
                        {r.status === "pending" && <span className="text-problem">pending</span>}
                        {r.status === "paid" && <span className="text-gain">sent</span>}
                        {r.status === "refunded" && (
                          <span className="text-ghost">refunded</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {pendingRequests.length > 0 && (
                <p className="text-ghost text-xs mt-2">
                  {pendingRequests.length} waiting on review.
                </p>
              )}
            </Frame>

          </>
        ) : (
          <Frame title="your signal" tone="dim" className="mb-6">
            <p className="text-dim text-sm">
              sign in on the{" "}
              <Link href="/" className="underline hover:text-terminal">
                terminal
              </Link>{" "}
              to see your balance.
            </p>
          </Frame>
        )}

        <Frame title="redemption protocols — offline" tone="alert" className="mb-6">
          <ul className="space-y-2 text-sm">
            {LOCKED_ITEMS.map((item) => (
              <li key={item.label} className="flex justify-between text-dim">
                <span>
                  <span className="text-problem">{item.cost ? `? ${item.cost}` : "??"}</span>{" "}
                  {item.label}
                </span>
                <span className="text-alert text-xs">[ LOCKED ]</span>
              </li>
            ))}
          </ul>
          <p className="text-dim text-xs mt-4">
            the terminal is still negotiating with its handlers. your balance is real.
            spend paths are coming.
          </p>
        </Frame>

        <Frame title="top miners" tone="dim">
          {ladder.length === 0 && <p className="text-dim text-sm">nobody has fed it yet.</p>}
          <ol className="space-y-1 text-sm">
            {ladder.map((row, i) => (
              <li key={row.user_id} className="flex justify-between text-dim">
                <span>
                  {i + 1}. {row.username ?? `troublemaker_${row.user_id.slice(0, 6)}`}
                </span>
                <span className="text-problem">{row.balance}</span>
              </li>
            ))}
          </ol>
        </Frame>

        {session && (
          <Frame title="ledger" tone="dim" className="mt-6">
            {ledger.length === 0 && (
              <p className="text-dim text-sm">no transactions yet — go talk to it.</p>
            )}
            <ul className="chat-scroll space-y-1 text-sm max-h-64 overflow-y-auto pr-1">
              {ledger.map((row) => (
                <li key={row.id} className="flex justify-between gap-3 text-dim">
                  <span className="text-problem">
                    {row.delta > 0 ? "+" : ""}
                    {row.delta} {row.reason}
                  </span>
                  <span className="shrink-0">{new Date(row.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </Frame>
        )}

        <p className="relative z-[1] text-foreground text-xs mt-8 text-center [text-shadow:0_1px_3px_var(--background)]">
          part of the{" "}
          <a
            href="https://trollrunner.net"
            className="glow-loop underline decoration-dim underline-offset-4"
          >
            trollrunner.net
          </a>{" "}
          network
        </p>
        <Faq />
      </div>
    </main>
  );
}
