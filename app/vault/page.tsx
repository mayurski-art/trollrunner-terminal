"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import {
  centeredPopoutPos,
  clampPopoutPos,
  getDesktopServerSnapshot,
  getDesktopSnapshot,
  subscribeDesktop,
} from "@/lib/popout";
import { getPublicClient } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import Meter from "@/components/Meter";
import { BANNER_VAULT } from "@/lib/ascii";
import { describeAddressProblem, isValidSolanaAddress, shortenAddress } from "@/lib/solanaAddress";
import { MIN_WALLET_SUBMIT_PROBLEMS, trollForProblems } from "@/lib/redemption";

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

// Popped-out ledger's desktop size, in viewport px. Module scope, not the
// component body - as a fresh object each render it counts as a changing
// dependency of every callback that reads it.
const POPOUT_SIZE = { width: 720, height: 640 };
const QUALIFYING_INTERVAL = 7;
const XP_PER_PROBLEM = 25;
const MIN_REDEEM = 5;
const LADDER_REFRESH_MS = 12_000;
// Top miners shows a full 20. The board is the last panel in its column and
// stretches to match the taller column beside it (see .vault-col-left in
// globals.css), so a 10-name list left a large empty gap under the names.
const LADDER_SIZE = 20;

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

  // The ledger is the one panel here that's a list rather than a form —
  // inside the column it's capped to a short scroll box, so a long history
  // is read a few rows at a time. Popping it out gives it a real window.
  // Same pattern as the homepage's "speak to it" chat popout.
  const [ledgerPopped, setLedgerPopped] = useState(false);
  // Viewport px; the popped Frame is position:fixed and draggable by its
  // title bar. Re-centred each time it opens, then follows the drag.
  const [popoutPos, setPopoutPos] = useState({ top: 0, left: 0 });
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  // Drives the desktop-only sizing/drag of the popout, matching the
  // lg:-prefixed classes it sits alongside.
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot
  );
  // The popout button portals into the ledger Frame's own top-right corner
  // (Frame's cornerAction). State, not a bare ref, so the portal re-renders
  // once the target div actually mounts.
  const [ledgerPopoutPortalEl, setLedgerPopoutPortalEl] = useState<HTMLDivElement | null>(null);
  const ledgerPopoutPortalRef = useCallback((el: HTMLDivElement | null) => {
    setLedgerPopoutPortalEl(el);
  }, []);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  // Opening the popout centers it; closing leaves the position alone so it
  // isn't recomputed on the way out. Centering happens here rather than in
  // an effect so the panel is placed in the same render that shows it.
  const toggleLedgerPopped = useCallback(() => {
    setLedgerPopped((wasPopped) => {
      if (!wasPopped) setPopoutPos(centeredPopoutPos(POPOUT_SIZE));
      return !wasPopped;
    });
  }, []);

  // A popped panel that was dragged near an edge can end up off-screen when
  // the window shrinks; re-center rather than leaving it stranded.
  useEffect(() => {
    if (!ledgerPopped || !isDesktop) return;
    const onResize = () => setPopoutPos(centeredPopoutPos(POPOUT_SIZE));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ledgerPopped, isDesktop]);

  useEffect(() => {
    if (!ledgerPopped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLedgerPopped(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ledgerPopped]);

  const handlePopoutHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTop: popoutPos.top,
        startLeft: popoutPos.left,
      };
    },
    [isDesktop, popoutPos]
  );
  const handlePopoutHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setPopoutPos(
      clampPopoutPos(
        POPOUT_SIZE,
        drag.startTop + (e.clientY - drag.startY),
        drag.startLeft + (e.clientX - drag.startX)
      )
    );
  }, []);
  const handlePopoutHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
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
          .limit(LADDER_SIZE);
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

    // The ladder moves while you sit and watch it — someone else mining does
    // not fire any of the events above, so without this the top miners board
    // stays frozen until you tab away and back. Gated on visibility so a
    // backgrounded vault isn't querying forever.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, LADDER_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
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

  async function saveAddress() {
    const address = addressInput.trim();
    if (addressBusy || !session) return;
    if ((wallet?.balance ?? 0) < MIN_WALLET_SUBMIT_PROBLEMS) {
      setAddressError(`you need at least ${MIN_WALLET_SUBMIT_PROBLEMS} PROBLEMS to submit a wallet`);
      return;
    }
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

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg vault-hero-bg" />
      </div>
      {/* No max-w cap here: below `lg` .vault-content is a single column
          whose children carry their own max-w, and at `lg` and up the
          grid's first track is sized to track the background art (see
          globals.css), which a wrapper cap would clip on wide screens. */}
      <div className="w-full vault-content">
        <div className="vault-col-center max-w-4xl lg:max-w-none mx-auto w-full lg:mx-0">
          <Nav networkBadge />
          <Banner art={BANNER_VAULT} label="the vault" tone="problem" maxFontPx={30} />
          <p className="text-foreground text-sm mb-8">
            your signal balance · xp redemption and $troll airdrops, live
          </p>

          {loadError && (
            <p className="text-alert text-xs mb-3">[ {loadError} ]</p>
          )}

          {session ? (
            /* The ledger used to be its own Frame over in the right column.
               It tells the same story as the numbers above it — what you
               have, and where it came from — so it lives inside this panel
               now as a labelled section rather than a separate box. Popping
               out still lifts the whole Frame into its own window (see the
               `ledgerPopped` className below), where the history is the
               point and the balance block reads as its header. */
            <Frame
              title="your signal"
              tone="problem"
              className={
                ledgerPopped
                  ? "fixed top-3 left-3 right-5 bottom-5 z-50 lg:inset-auto lg:top-auto lg:left-auto lg:right-auto lg:bottom-auto lg:w-auto lg:max-w-[95vw] lg:max-h-[95vh] flex flex-col chat-popout-in"
                  : "mb-6 flex flex-col min-h-0"
              }
              style={
                ledgerPopped && isDesktop
                  ? {
                      top: `${popoutPos.top}px`,
                      left: `${popoutPos.left}px`,
                      width: `${POPOUT_SIZE.width}px`,
                      height: `${POPOUT_SIZE.height}px`,
                      right: "auto",
                      bottom: "auto",
                    }
                  : undefined
              }
              bodyClassName="flex flex-col flex-1 min-h-0"
              titleEffect="trace"
              traceHue="#ffd21f"
              cornerAction={<div ref={ledgerPopoutPortalRef} />}
              onHeaderPointerDown={
                ledgerPopped && isDesktop ? handlePopoutHeaderPointerDown : undefined
              }
              onHeaderPointerMove={
                ledgerPopped && isDesktop ? handlePopoutHeaderPointerMove : undefined
              }
              onHeaderPointerUp={ledgerPopped && isDesktop ? handlePopoutHeaderPointerUp : undefined}
            >
              <p className="text-4xl text-problem mb-3">
                {wallet?.balance ?? "..."}{" "}
                <span className="text-sm text-dim align-middle">PROBLEMS</span>
              </p>
              <p className="text-dim text-xs mb-3">
                lifetime mined: {wallet?.lifetime_earned ?? 0}
              </p>
              <Meter
                width={10}
                fraction={(wallet?.qualifying_count ?? 0) / QUALIFYING_INTERVAL}
                tone="problem"
                label={`mining progress: ${wallet?.qualifying_count ?? 0}/${QUALIFYING_INTERVAL}`}
              />

              {/* Hairline rule + label stand in for the border the ledger
                  used to have, so the history still reads as its own thing
                  inside the shared panel. */}
              <p className="mt-4 mb-2 border-t border-dim/40 pt-3 text-xs tracking-wide text-dim">
                ledger
              </p>
              {ledger.length === 0 && (
                <p className="text-dim text-sm">no transactions yet — go talk to it.</p>
              )}
              {/* In-flow the list is capped so the merged panel can't run
                  away down the page; popped out it drops the cap and fills
                  the window instead, which is the reason to pop it. */}
              <ul
                className={`chat-scroll space-y-1 text-sm overflow-y-auto pr-1 ${
                  ledgerPopped ? "flex-1 min-h-0" : "max-h-64"
                }`}
              >
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

          {/* Portals into the merged panel's own top-right corner
              (Frame's cornerAction), so the control sits on the box it
              pops rather than anywhere in the flow. */}
          {ledgerPopoutPortalEl &&
            createPortal(
              <button
                type="button"
                onClick={toggleLedgerPopped}
                aria-label={ledgerPopped ? "shrink ledger" : "pop out ledger"}
                className="rounded border border-problem/50 bg-problem/10 px-2 py-1 text-xs font-semibold tracking-wide text-problem transition-colors hover:bg-problem/20 hover:border-problem"
              >
                {ledgerPopped ? "⤡ shrink" : "⤢ pop out"}
              </button>,
              ledgerPopoutPortalEl
            )}

          {ledgerPopped && (
            <div
              className="fixed inset-0 z-40 bg-background/90"
              onClick={() => setLedgerPopped(false)}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="vault-col-left max-w-4xl lg:max-w-none mx-auto w-full lg:mx-0">
          {session && (
            <Frame title="redeem for xp" tone="dim" className="mb-6">
              <p className="text-dim text-xs mb-3">
                1 PROBLEM = {XP_PER_PROBLEM} XP, one-way, minimum {MIN_REDEEM} at a time.
              </p>
              <div className="flex gap-2 vault-amount-form">
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
          )}

          <Frame title="top miners" tone="dim" className="mb-6 lg:mb-0">
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
        </div>

        <div className="vault-col-right max-w-4xl lg:max-w-3xl mx-auto w-full lg:mx-0">
          {session && (
            <Frame title="$troll airdrop" tone="dim" className="mb-6">
              {round && (
                <p className="text-dim text-xs mb-3">
                  {round.problemsPerTroll} PROBLEMS: 1 $TROLL
                </p>
              )}
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
                    {(wallet?.balance ?? 0) < MIN_WALLET_SUBMIT_PROBLEMS ? (
                      <>
                        needs {MIN_WALLET_SUBMIT_PROBLEMS} PROBLEMS to unlock ({wallet?.balance ?? 0}/
                        {MIN_WALLET_SUBMIT_PROBLEMS}).
                      </>
                    ) : (
                      <>
                        paste YOUR solana address for a $TROLL airdrop. reviewed — this is a
                        request, not a claim.
                      </>
                    )}
                  </p>
                  <div className="flex gap-2 vault-amount-form">
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
                      disabled={addressBusy || (wallet?.balance ?? 0) < MIN_WALLET_SUBMIT_PROBLEMS}
                      className="flex-1 min-w-0 bg-transparent border border-dim px-2 py-1 text-sm text-problem font-mono outline-none focus:border-problem disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={saveAddress}
                      disabled={
                        addressBusy ||
                        !isValidSolanaAddress(addressInput) ||
                        (wallet?.balance ?? 0) < MIN_WALLET_SUBMIT_PROBLEMS
                      }
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
                double-check it. an airdrop sent to a wrong address is not my PROBLEM. haha.
              </p>

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
          )}
        </div>

      </div>
    </main>
  );
}
