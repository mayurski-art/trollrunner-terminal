"use client";

import { useEffect, useState } from "react";

export type LiveUser = {
  userId: string;
  username: string;
  liveChat: boolean;
  liveUndervoice: boolean;
};

const LIVE_POLL_MS = 5000;

// Owner-only roster of whoever is talking to the terminal right now, rendered
// inside [ speak to it ] so hopping into a conversation doesn't mean leaving
// the page. /inspect keeps its own separate (read-only) copy of this list.
//
// Collapsed by default and on purpose: the panel this sits in is height-locked
// on desktop (lg:h-[34rem] in app/page.tsx) and already portals its status and
// controls rows into a separate Frame because vertical space there is scarce.
// A permanently-expanded list of names would eat the transcript.
export default function HopInRoster({
  getAuthHeader,
  selectedUserId,
  onSelect,
}: {
  getAuthHeader: () => Promise<Record<string, string>>;
  selectedUserId: string | null;
  onSelect: (user: LiveUser | null) => void;
}) {
  const [live, setLive] = useState<LiveUser[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const headers = await getAuthHeader();
        if (!headers.Authorization) return;
        const res = await fetch("/api/admin/live", { headers, cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLive(data.live ?? []);
      } catch {
        // Non-fatal — the roster just won't refresh this tick.
      }
    }

    load();
    const id = setInterval(load, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [getAuthHeader]);

  const count = live.length;

  return (
    <div className="shrink-0 mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-ghost hover:text-terminal transition-colors"
      >
        <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span>
          {count} live{" "}
          {count > 0 && (
            <span className="text-problem" aria-hidden="true">
              ●
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {count === 0 && <p className="text-dim text-xs">nobody is talking to it right now.</p>}
          {live.map((u) => {
            const active = selectedUserId === u.userId;
            return (
              <button
                key={u.userId}
                type="button"
                onClick={() => onSelect(active ? null : u)}
                aria-pressed={active}
                className={`border px-2 py-1 text-xs transition-colors ${
                  active
                    ? "border-problem text-problem"
                    : "border-dim text-dim hover:border-terminal hover:text-terminal"
                }`}
              >
                {u.username}
                {u.liveUndervoice && (
                  <span className="text-problem ml-1" title="undervoice session open">
                    ▲
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
