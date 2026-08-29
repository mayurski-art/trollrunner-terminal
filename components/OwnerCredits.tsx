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

  const isOwner = displayName(session) === OWNER_USERNAME;

  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = getPublicClient();
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
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

  if (!isOwner) return null;
  if (error) return <p className="text-alert text-xs">[ credits: {error} ]</p>;
  if (!usage) return null;

  // Warn before the app's own low-balance auto-pause trips (lib/budget.ts
  // stops generation once remaining drops under low_balance_pause_usd),
  // rather than after the terminal has already gone quiet.
  const low = usage.remainingUsd < 3;

  return (
    <div className="mt-2">
      <Meter
        fraction={usage.percentUsed / 100}
        tone={low ? "alert" : "problem"}
        label={`api credits: ${usd(usage.remainingUsd)} left`}
      />
      <p className="text-dim text-xs mt-1">
        spent {usd(usage.spentUsd)} of {usd(usage.startingCreditUsd)}
        {low && <span className="text-alert"> · running low</span>}
      </p>
    </div>
  );
}
