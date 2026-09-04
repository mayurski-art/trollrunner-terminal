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
      {/* Non-breaking spaces, not plain ones. A plain trailing space at the
          end of a line box is collapsed away by inline layout, but the same
          space mid-line (where another copy follows it) is preserved — so
          the two otherwise-identical copies measured 862.75px and 856.92px.
          That 5.9px asymmetry means translateX(-50%) no longer lands on the
          seam, and the loop drifts further out of true every pass. A
          non-breaking space never collapses, so both copies measure the
          same. */}
      {" · "}
    </>
  );

  return (
    <div className="site-ticker mb-6">
      {/* ONE animated element (the track) holding two inline copies of the
          text. Everything else about this is subordinate to that: earlier
          versions animated the two copies as two SEPARATE elements with
          two separate keyframe animations, which requires the browser to
          keep two independent animation instances in perfect lockstep
          forever. Chrome does; iOS Safari does not reliably, and the two
          copies converged into overlapping, doubled-up text on a real
          iPhone while every Chrome-based test showed a perfect zero-overlap
          loop. With a single animated element there are no two animations
          to desync — the copies are rigid siblings inside one moving box,
          so their spacing is a layout fact, not a timing coincidence. */}
      {/* No whitespace between these two spans: JSX collapses a newline
          between sibling elements into a real space text node, and under
          white-space:nowrap that space renders BETWEEN the copies. It made
          copy A measure 5.9px wider than copy B, so -50% of the track no
          longer landed exactly on the seam and the loop drifted a little
          further out of alignment every pass. Keep them adjacent. */}
      <div className="site-ticker-track">
        <span className="site-ticker-copy">{unit}</span>
        {/* prettier-ignore */}
        <span className="site-ticker-copy" aria-hidden="true">{unit}</span>
      </div>
    </div>
  );
}
