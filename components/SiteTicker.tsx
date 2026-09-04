"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A scrolling status line below the nav. The copy is ambient chrome in the
// persona's voice (no endpoint aggregates PROBLEMS/recoveries across every
// user, and making up numbers would be worse than showing none) — but the
// $TROLL quote spliced into it IS live, polled from /api/troll-price.
const TICKER_TEXT =
  "it surfaced inside trollrunner.net · a face with no body and no alibi · trolling has a face now · welcome, troublemaker";

const POLL_MS = 60_000;
// Safety valve for the repeat loop below, so a zero-width measurement (a
// display:none parent, a font that never loads) can never spin forever.
const MAX_REPEATS = 40;

type Quote = { priceUsd: number; change24h: number | null };

function formatPrice(price: number) {
  // Sub-cent meme-coin prices need more precision than a currency
  // formatter's default 2 decimals, which would render these as "$0.00".
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(3)}`;
}

export default function SiteTicker() {
  const [quote, setQuote] = useState<Quote | null>(null);
  // How many times one half repeats the copy. Measured, not guessed: a
  // half must be at least a viewport wide or a gap opens at the loop reset.
  const [repeats, setRepeats] = useState(1);
  const halfRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/troll-price");
        if (!res.ok) return; // keep the last good quote rather than blanking
        const data = await res.json();
        if (!cancelled && Number.isFinite(data?.priceUsd)) {
          setQuote({ priceUsd: data.priceUsd, change24h: data.change24h ?? null });
        }
      } catch {
        // Offline or blocked — the ticker just runs without a price.
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Grow the repeat count until one half spans the viewport. Re-runs on
  // resize and whenever the price text changes the unit's width.
  const measure = useCallback(() => {
    const half = halfRef.current;
    if (!half) return;
    const unitWidth = half.firstElementChild?.getBoundingClientRect().width ?? 0;
    if (unitWidth <= 0) return;
    const needed = Math.ceil(window.innerWidth / unitWidth);
    setRepeats(Math.min(Math.max(needed, 1), MAX_REPEATS));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, quote]);

  const unit = (
    <span className="site-ticker-copy">
      {TICKER_TEXT}
      {quote ? (
        <>
          {" · "}
          <span className="site-ticker-price">
            $TROLL {formatPrice(quote.priceUsd)}
            {quote.change24h !== null ? (
              <span
                className={
                  quote.change24h >= 0 ? "site-ticker-up" : "site-ticker-down"
                }
              >
                {" "}
                {quote.change24h >= 0 ? "▲" : "▼"}
                {Math.abs(quote.change24h).toFixed(2)}%
              </span>
            ) : null}
          </span>
        </>
      ) : null}
      {" · "}
    </span>
  );

  const half = Array.from({ length: repeats }, (_, i) => (
    <span key={i} className="site-ticker-unit">
      {unit}
    </span>
  ));

  return (
    <div className="site-ticker mb-6">
      {/* Two identical halves in a flex track. Each half repeats the copy
          enough times to be at least one viewport wide, so the second half
          is always already covering the screen when the first scrolls off.
          The animation shifts the track by -50% — exactly one half — so the
          reset frame is pixel-identical to the start: no seam, no blank
          tail. aria-hidden on the clone stops screen readers reading it
          twice. */}
      <div className="site-ticker-track">
        <div className="site-ticker-half" ref={halfRef}>
          {half}
        </div>
        <div className="site-ticker-half" aria-hidden="true">
          {half}
        </div>
      </div>
    </div>
  );
}
