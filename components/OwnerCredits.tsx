"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";
import { displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";
import Meter from "@/components/Meter";

type Usage = {
  startingCreditUsd: number;
  spentUsd: number;
  remainingUsd: number;
  percentUsed: number;
};

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

// Owner-only API credit readout. Rendered for nobody but troll_runner, and
// backed by an owner-gated endpoint — the check here is just so the UI
// doesn't flash for other accounts; /api/admin/credits is what actually
// keeps the numbers private.
export default function OwnerCredits({ session }: { session: Session | null }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);

  const isOwner = displayName(session) === OWNER_USERNAME;

  async function authToken(): Promise<string | null> {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await authToken();
        if (!token) return;
        const res = await fetch("/api/admin/credits", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "could not read credits");
          return;
        }
        setUsage(body.usage ?? null);
      } catch {
        if (!cancelled) setError("connection to the terminal was lost");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await authToken();
        if (!token) return;
        const res = await fetch("/api/admin/chat-pause", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json();
        if (!cancelled && res.ok) setPaused(!!body.paused);
      } catch {
        // silent — the button just won't render its state yet
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner]);

  async function togglePause() {
    if (pauseBusy || paused === null) return;
    setPauseBusy(true);
    const next = !paused;
    try {
      const token = await authToken();
      if (!token) return;
      const res = await fetch("/api/admin/chat-pause", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ paused: next }),
      });
      if (res.ok) setPaused(next);
    } finally {
      setPauseBusy(false);
    }
  }

  if (!isOwner) return null;

  return (
    <div className="mt-2">
      {paused !== null && (
        <button
          type="button"
          onClick={togglePause}
          disabled={pauseBusy}
          aria-pressed={paused}
          aria-label={paused ? "Unlock the terminal for chat" : "Lock the terminal — stop everyone from chatting"}
          className={`mb-2 border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
            paused
              ? "border-alert text-alert hover:bg-alert hover:text-background"
              : "border-dim text-dim hover:border-terminal hover:text-terminal"
          }`}
        >
          [ {pauseBusy ? "..." : paused ? "chat locked — click to unlock" : "lock chat"} ]
        </button>
      )}
      {error && <p className="text-alert text-xs">[ credits: {error} ]</p>}
      {usage && (
        <>
          <Meter
            fraction={usage.percentUsed / 100}
            tone={usage.remainingUsd < 3 ? "alert" : "problem"}
            label={`api credits: ${usd(usage.remainingUsd)} left`}
          />
          <p className="text-dim text-xs mt-1">
            spent {usd(usage.spentUsd)} of {usd(usage.startingCreditUsd)}
            {usage.remainingUsd < 3 && <span className="text-alert"> · running low</span>}
          </p>
        </>
      )}
    </div>
  );
}
