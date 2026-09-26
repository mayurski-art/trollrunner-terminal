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
import SpendSignal from "@/components/SpendSignal";

type Wallet = {
  balance: number;
  lifetime_earned: number;
  qualifying_count: number;
};

type LedgerRow = { id: string; delta: number; reason: string; created_at: string };
type LadderRow = { user_id: string; balance: number; username: string | null };
// Popped-out ledger's desktop size, in viewport px. Module scope, not the
// component body - as a fresh object each render it counts as a changing
// dependency of every callback that reads it.
const POPOUT_SIZE = { width: 720, height: 640 };
const QUALIFYING_INTERVAL = 7;
const LADDER_REFRESH_MS = 12_000;
// Top miners shows a full 20 — 10 left the board looking half empty.
const LADDER_SIZE = 20;

export default function VaultPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ladder, setLadder] = useState<LadderRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  // The popout button portals into the "your signal" Frame's top-right corner
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
        {/* Nav + banner are their own full-width row so they stop setting
            the start height of column 1. The banner is fit-to-width ASCII
            art whose height tracks the viewport (measured 59.8px at 1100
            up to 158.3px at 2560) — while it sat inside .vault-col-center,
            "your signal" started that much lower than "spend your signal"
            opposite it, and no fixed offset could follow it. With the
            header lifted out, both panels begin the next grid row and
            align by construction at every width. */}
        <div className="vault-col-head max-w-4xl lg:max-w-none mx-auto w-full lg:mx-0">
          <Nav networkBadge />
          <Banner art={BANNER_VAULT} label="the vault" tone="problem" maxFontPx={30} />
        </div>

        <div className="vault-col-center max-w-4xl lg:max-w-none mx-auto w-full lg:mx-0">
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

          {/* Gated on session like the panel itself: signing out while
              popped unmounts the Frame, and an ungated backdrop would be
              left covering the page on its own. */}
          {session && ledgerPopped && (
            <div
              className="fixed inset-0 z-40 bg-background/90"
              onClick={() => setLedgerPopped(false)}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="vault-col-left max-w-4xl lg:max-w-none mx-auto w-full lg:mx-0">

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

        <div className="vault-col-right max-w-4xl lg:max-w-none mx-auto w-full lg:mx-0">
          {/* redeem-for-xp and $troll-airdrop were two separate panels in
              two different columns, but they are one decision — what to
              spend PROBLEMS on — so they read as one panel with two
              labelled halves, using the same hairline-rule treatment the
              ledger uses inside "your signal" above. */}
          {session && (
            <Frame title="spend your signal" tone="dim" className="mb-6">
              <SpendSignal
                balance={wallet?.balance ?? 0}
                onBalanceChange={(balance) => setWallet((w) => (w ? { ...w, balance } : w))}
              />
            </Frame>
          )}
        </div>

      </div>
    </main>
  );
}
