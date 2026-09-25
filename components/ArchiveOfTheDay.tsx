"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isLoopGifAsset } from "@/lib/loreAssets";

type Pick = {
  number: number;
  title: string;
  depth: 1 | 2;
  teaser: string;
  truncated: boolean;
  seeded: boolean;
  image: { url: string; caption: string } | null;
  dayKey: string;
  endsAt: string;
};

// How long after load the panel slides in. Long enough that it doesn't
// fight the page's own entrance for attention, short enough that someone
// who came to read a transmission still sees it.
const REVEAL_DELAY_MS = 2600;

// Dismissal is remembered per archive day, so closing today's panel doesn't
// suppress tomorrow's. Keyed by dayKey rather than a timestamp so the
// rollover and the dismissal always agree on where the boundary is.
const DISMISS_KEY = "tt-aotd-dismissed";

function readDismissed(): string | null {
  try {
    return window.localStorage.getItem(DISMISS_KEY);
  } catch {
    // Private windows and blocked site data throw on access — the panel
    // should still work, it just won't remember being closed.
    return null;
  }
}

function writeDismissed(dayKey: string) {
  try {
    window.localStorage.setItem(DISMISS_KEY, dayKey);
  } catch {
    /* no-op: see readDismissed */
  }
}

function countdown(endsAt: string, now: number): string {
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "rotating...";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// One lore file spotlighted a day, rotating at 5 PM Pacific. Slides in from the
// right on the front page. Shows a title, one image and the opening couple
// of sentences — never the full body, which still costs PROBLEMS to
// recover in the archive. The CTA deep-links to that file.
export default function ArchiveOfTheDay() {
  const [pick, setPick] = useState<Pick | null>(null);
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts?: { immediate?: boolean }) => {
    try {
      const res = await fetch("/api/archive-of-the-day");
      const data = await res.json();
      if (data.error) return;
      const next = data as Pick;
      if (readDismissed() === next.dayKey) {
        // Already closed today — keep it loaded so the rollover timer can
        // still bring the next day's pick in, but stay hidden.
        setPick(next);
        return;
      }
      setPick(next);
      if (opts?.immediate) {
        setShown(true);
      } else {
        revealTimer.current = setTimeout(() => setShown(true), REVEAL_DELAY_MS);
      }
    } catch {
      /* the panel is decorative — a failed fetch just means no panel */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, [load]);

  // Drives the countdown, and swaps in the next day's file the moment the
  // rollover passes — without this, a tab left open overnight would show
  // yesterday's pick indefinitely.
  useEffect(() => {
    if (!pick) return;
    const tick = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= new Date(pick.endsAt).getTime()) {
        setShown(false);
        setClosing(false);
        load({ immediate: true });
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [pick, load]);

  const dismiss = useCallback(() => {
    if (!pick) return;
    setClosing(true);
    writeDismissed(pick.dayKey);
    // Let the slide-out finish before unmounting the content.
    setTimeout(() => {
      setShown(false);
      setClosing(false);
    }, 240);
  }, [pick]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, dismiss]);

  if (!pick || !shown) return null;

  const href = `/archive?file=${pick.number}`;
  const cta = pick.seeded ? "read the file" : "recover this file";

  return (
    <aside
      // Mobile pins it to the bottom edge (a side drawer on a phone would
      // cover the whole screen); desktop slides it in from the right, clear
      // of the fixed bottom-right footer.
      // Width is set in px, not a rem utility: this app's root font-size is
      // 11.2px (not the usual 16), so every rem-based Tailwind size renders
      // at 0.7x — sm:w-80 would come out 224px, too cramped for a teaser.
      className={`fixed z-40 left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:w-[310px] ${
        closing ? "aotd-out" : "aotd-in"
      }`}
      aria-label="archive of the day"
    >
      <div className="relative border border-terminal bg-panel/95 backdrop-blur-sm shadow-[0_0_24px_rgba(0,0,0,0.5)]">
        <span className="absolute -top-2.5 left-3 bg-panel px-1.5 text-terminal text-[10px] lg:text-sm tracking-wide">
          [ archive of the day ]
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="dismiss archive of the day"
          className="absolute -top-2.5 right-2 bg-panel px-1.5 text-dim hover:text-terminal text-[10px] lg:text-sm leading-none"
        >
          [ x ]
        </button>

        <div className="px-3 pt-4 pb-3">
          {pick.image &&
            (isLoopGifAsset(pick.image.url) ? (
              <video
                src={pick.image.url}
                autoPlay
                muted
                loop
                playsInline
                className="mb-2 w-full h-[120px] object-cover border border-dim"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pick.image.url}
                alt={pick.image.caption}
                className="mb-2 w-full h-[120px] object-cover border border-dim"
              />
            ))}

          <p className="text-terminal text-xs mb-1 leading-snug">
            <span className="text-dim">file {pick.number}</span>
            {pick.depth === 2 && <span className="text-alert"> · deep</span>}
          </p>
          <h2 className="text-foreground text-sm leading-snug mb-1.5">{pick.title}</h2>
          <p className="text-dim text-xs leading-relaxed">
            {pick.teaser}
            {pick.truncated && <span className="text-terminal"> [...]</span>}
          </p>

          <div className="mt-3 flex items-center justify-between gap-2">
            <a
              href={href}
              className="text-terminal text-xs underline decoration-dim underline-offset-4 hover:text-foreground"
            >
              [ {cta} ]
            </a>
            <span className="text-dim text-[10px] lg:text-sm tabular-nums" title="next file at 5 PM Pacific">
              {countdown(pick.endsAt, now)}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
