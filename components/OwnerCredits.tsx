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

// Owner-only API credit readout + chat lock toggle. Rendered for nobody but
// troll_runner, and backed by owner-gated endpoints — the check here is
// just so the UI doesn't flash for other accounts; /api/admin/credits and
// /api/admin/chat-pause are what actually keep this private/effective.
//
// Two independent sections so Nav.tsx can place each on its own side of the
// nav (usage under [ menu ], the lock button under the auth pill) — each
// instance only fetches the endpoint its own section needs, rather than
// both instances polling both endpoints.
type Section = "usage" | "lock";

export default function OwnerCredits({
  session,
  section,
}: {
  session: Session | null;
  section: Section;
}) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [paused, setPaused] = useState<boolean | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);

  const isOwner = displayName(session) === OWNER_USERNAME;

  async function authToken(): Promise<string | null> {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? null;
  }

  useEffect(() => {
    if (!isOwner || section !== "usage") return;
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
        if (!res.ok) return;
        setUsage(body.usage ?? null);
      } catch {
        // silent — the meter just won't render until the next successful fetch
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, section]);

  useEffect(() => {
    if (!isOwner || section !== "lock") return;
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
  }, [isOwner, section]);

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

  if (section === "lock") {
    if (paused === null) return null;
    return (
      <button
        type="button"
        onClick={togglePause}
        disabled={pauseBusy}
        aria-pressed={paused}
        aria-label={paused ? "Unlock the terminal for chat" : "Lock the terminal — stop everyone from chatting"}
        className={`mt-2 border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
          paused
            ? "border-alert text-alert hover:bg-alert hover:text-background"
            : "border-dim text-dim hover:border-terminal hover:text-terminal"
        }`}
      >
        [ {pauseBusy ? "..." : paused ? "chat locked — click to unlock" : "lock chat"} ]
      </button>
    );
  }

  if (!usage) return null;
  return (
    <div className="mt-2">
      <Meter
        fraction={usage.percentUsed / 100}
        tone={usage.remainingUsd < 3 ? "alert" : "problem"}
        label={`api credits: ${usd(usage.remainingUsd)} left`}
      />
      <p className="text-dim text-xs mt-1">
        spent {usd(usage.spentUsd)} of {usd(usage.startingCreditUsd)}
        {usage.remainingUsd < 3 && <span className="text-alert"> · running low</span>}
      </p>
    </div>
  );
}
