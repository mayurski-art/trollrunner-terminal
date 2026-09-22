"use client";

import { useEffect, useRef, useState } from "react";
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

type ProviderStatus = {
  name: string;
  configured: boolean;
  reachable: boolean | null;
  quota: {
    requestsRemaining: number;
    requestsLimit: number;
    tokensRemaining: number;
    tokensLimit: number;
    resetRequests: string | null;
  } | null;
  note: string;
  model?: string;
  deadSlug?: boolean;
  // Seconds-until-retry AS OF WHEN THE SERVER ANSWERED — a snapshot, not a
  // live value. Converted to an absolute deadline the moment the response
  // lands (see providerDeadlines below) so the UI can tick a real countdown
  // instead of rendering a number that's already stale by the time someone
  // reads it.
  retryAfterSeconds?: number | null;
};

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

// Same compact style as Chat.tsx's CooldownNotice — "8m38s" / "42s" — rather
// than a second countdown format existing anywhere else in the app.
function fmtCountdown(seconds: number): string {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)}h`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s`;
  return `${Math.max(0, Math.round(seconds))}s`;
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
  const [providers, setProviders] = useState<ProviderStatus[] | null>(null);
  // Absolute deadline (ms epoch) per provider name, computed once when a
  // fetch lands by adding retryAfterSeconds to Date.now() — this is what
  // makes the countdown real instead of a number frozen at fetch time. A
  // ref, not state: it's only ever read inside the ticking interval below,
  // and updating it via setState on every fetch would be one more render
  // this component doesn't need.
  const deadlinesRef = useRef<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  // Collapsed by default — the full meters + free-tier provider list ran
  // permanently down the top-left corner of every page for the owner,
  // eating vertical space nobody but troll_runner ever needed visible at
  // all times. A one-line summary now stands in until expanded.
  const [expanded, setExpanded] = useState(false);

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

  // Free-tier provider status, fetched alongside the paid-credit meter. This
  // is a separate call because the check pings three external APIs and is
  // slower than reading our own spend ledger — no reason to hold the credit
  // meter behind it.
  useEffect(() => {
    if (!isOwner || section !== "usage") return;
    let cancelled = false;
    (async () => {
      try {
        const token = await authToken();
        if (!token) return;
        const res = await fetch("/api/admin/free-tier", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json();
        if (cancelled || !res.ok) return;
        const list: ProviderStatus[] = body.providers ?? [];
        const now = Date.now();
        for (const p of list) {
          if (typeof p.retryAfterSeconds === "number" && p.retryAfterSeconds > 0) {
            deadlinesRef.current[p.name] = now + p.retryAfterSeconds * 1000;
          } else {
            delete deadlinesRef.current[p.name];
          }
        }
        setProviders(list);
      } catch {
        // silent — the provider list just won't render
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, section]);

  // Ticks once a second only while at least one provider has a live
  // countdown running, so this never spins a dangling interval for the rest
  // of the session on a page where nothing's currently down.
  useEffect(() => {
    if (!providers?.some((p) => deadlinesRef.current[p.name])) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [providers]);

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

  if (!usage && !providers) return null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        className="mt-2 text-xs text-dim hover:text-terminal transition-colors"
      >
        [ {usage ? `api: ${usd(usage.remainingUsd)} left` : "api usage"} · details ]
      </button>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(false)}
        aria-expanded={true}
        className="text-xs text-dim hover:text-terminal transition-colors mb-1"
      >
        [ hide details ]
      </button>
      {usage && (
        <>
          <Meter
            width={10}
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
      {providers && (
        <div className="mt-2">
          <p className="text-ghost text-xs mb-1">free tier</p>
          {providers.map((p) => {
            // Only groq reports a quota, so only groq gets a bar. The others
            // show reachability, which is the honest limit of what their APIs
            // tell us — see app/api/admin/free-tier/route.ts.
            const q = p.quota;
            const fraction = q && q.requestsLimit > 0 ? q.requestsRemaining / q.requestsLimit : 0;
            // Live seconds-left, ticked from the absolute deadline computed
            // when this provider's status last landed — never the raw
            // retryAfterSeconds from the response, which is already stale by
            // render time. A dead slug (404) has no deadline at all: no
            // amount of waiting fixes that, so it never gets a countdown.
            const deadline = deadlinesRef.current[p.name];
            const secondsLeft = deadline ? Math.max(0, Math.round((deadline - nowTick) / 1000)) : 0;
            const counting = secondsLeft > 0;
            return (
              <div key={p.name} className="mb-1">
                {q ? (
                  <>
                    <Meter
                      width={10}
                      fraction={1 - fraction}
                      tone={fraction < 0.15 ? "alert" : "problem"}
                      label={`${p.name}: ${q.requestsRemaining}/${q.requestsLimit} reqs`}
                    />
                    <p className="text-dim text-xs">
                      {q.tokensRemaining.toLocaleString()} tokens left
                      {counting && ` · resets in ${fmtCountdown(secondsLeft)}`}
                    </p>
                  </>
                ) : (
                  <p className="text-dim text-xs">
                    <span
                      aria-hidden="true"
                      className={
                        !p.configured
                          ? "text-ghost"
                          : p.reachable
                            ? "text-terminal"
                            : p.deadSlug
                              ? "text-alert"
                              : "text-problem"
                      }
                    >
                      ●
                    </span>{" "}
                    {p.name}
                    {!p.configured && " — no key"}
                    {p.configured && p.reachable && " — up"}
                    {p.configured && !p.reachable && p.deadSlug && ` — dead model id (${p.note})`}
                    {p.configured &&
                      !p.reachable &&
                      !p.deadSlug &&
                      (counting ? ` — back in ${fmtCountdown(secondsLeft)}` : ` — ${p.note}`)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}