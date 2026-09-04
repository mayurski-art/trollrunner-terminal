"use client";

import { useEffect, useState } from "react";

// A scrolling status line below the nav. The copy is ambient chrome in the
// persona's voice (no endpoint aggregates PROBLEMS/recoveries across every
// user, and making up numbers would be worse than showing none) — but the
// $TROLL quote spliced into it IS live, polled from /api/troll-price.
const TICKER_TEXT =
  "it surfaced inside trollrunner.net · a face with no body and no alibi · trolling has a face now · welcome, troublemaker";

const POLL_MS = 60_000;

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

  const unit = (
    <>
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
    </>
  );

  return (
    <div className="site-ticker mb-6">
      {/* Two copies, each absolutely positioned and animated by the exact
          same keyframes. Copy 2 starts at left:100% — i.e. rigidly one
          copy-width to the right of copy 1, guaranteed by CSS layout, not
          by a JS-measured repeat count. When copy 1 has scrolled fully off
          the left edge, copy 2 is sitting exactly where copy 1 started:
          the seam is structural, not computed, so there is nothing for a
          browser's flex/max-content sizing quirks to get wrong. */}
      <div className="site-ticker-copy site-ticker-copy--a">{unit}</div>
      <div className="site-ticker-copy site-ticker-copy--b" aria-hidden="true">
        {unit}
      </div>
    </div>
  );
}
