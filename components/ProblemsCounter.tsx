"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getPublicClient } from "@/lib/supabase";
import SpendSignal from "@/components/SpendSignal";

// The PROBLEMS balance, in the nav on every page. It used to only appear
// once you were already inside the archive or the undervoice, so "why won't
// this unlock" and "am I out of PROBLEMS" were the same question with no
// visible answer. Refetches on the `problems-changed` window event, which
// anything that spends or mints PROBLEMS dispatches, so the nav doesn't sit
// on a stale number after an unlock.
//
// Clicking it opens a small popup anchored under the counter with the
// vault's spend panel (redeem for xp, $troll airdrop) — the same
// SpendSignal component the vault page renders — so PROBLEMS can be spent
// from any page without a trip to [vault].
export default function ProblemsCounter() {
  const [balance, setBalance] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  // Viewport px for the popup's top-right corner, measured off the button.
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const sb = getPublicClient();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setBalance(null);
        return;
      }
      const res = await fetch("/api/wallet", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      setBalance(body.balance ?? 0);
    } catch {
      // A nav badge is not worth surfacing an error for — it just stays as-is.
    }
  }, []);

  useEffect(() => {
    load();
    // `problems-changed` covers the immediate case (an archive unlock on the
    // page you're already looking at); focus covers everything else — chat
    // minting, an undervoice session — without every one of those call sites
    // having to remember to announce itself.
    window.addEventListener("problems-changed", load);
    window.addEventListener("focus", load);
    return () => {
      window.removeEventListener("problems-changed", load);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // The popup is fixed-position, so re-anchor it under the counter when
    // the viewport changes (not close — a phone keyboard opening for the
    // inputs inside it fires resize too).
    const reanchor = () => measure();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", reanchor);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reanchor);
    };
  }, [open]);

  function measure() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 8, right: Math.max(16, window.innerWidth - rect.right) });
  }

  function toggle() {
    if (!open) measure();
    setOpen((o) => !o);
  }

  if (balance === null) return null;

  const popup = open ? (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="spend your PROBLEMS"
        className="fixed z-50 left-4 sm:left-auto sm:w-[22rem] max-h-[75vh] overflow-y-auto border border-problem/60 bg-panel/95 backdrop-blur-sm text-left p-4 chat-popout-in"
        style={{ top: anchor.top, right: anchor.right }}
      >
        <div className="flex items-center justify-between gap-4 mb-3">
          <span className="text-problem text-sm tracking-wide">▣ {balance} PROBLEMS</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="text-ghost hover:text-terminal transition-colors text-xs shrink-0"
          >
            [ close ]
          </button>
        </div>
        <SpendSignal balance={balance} onBalanceChange={setBalance} />
        <Link
          href="/vault"
          onClick={() => setOpen(false)}
          className="block mt-4 pt-3 border-t border-dim/40 text-xs text-dim hover:text-terminal transition-colors"
        >
          [ open the full vault → ]
        </Link>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="text-problem whitespace-nowrap hover:underline underline-offset-4"
        title={`${balance} PROBLEMS — click to spend them`}
      >
        ▣ {balance} PROBLEMS
      </button>
      {popup && typeof document !== "undefined" ? createPortal(popup, document.body) : null}
    </>
  );
}
