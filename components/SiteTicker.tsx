"use client";

import { useEffect, useState } from "react";

// A scrolling status line below the nav. The copy is ambient chrome in the
// persona's voice (no endpoint aggregates PROBLEMS/recoveries across every
// user, and making up numbers would be worse than showing none) — but the
// $TROLL quote spliced into it IS live, polled from /api/troll-price.
const TICKER_TEXT =
  "it surfaced inside trollrunner.net · a face with no body and no alibi · trolling has a face now · welcome, troublemaker";

const POLL_MS = 60_000;
// The NFT floor moves far more slowly than the token price (single-digit
// sales a day), and its route caches for 5 minutes anyway, so polling it as
// often as the token would just be wasted requests.
const NFT_POLL_MS = 300_000;

type Quote = { priceUsd: number; change24h: number | null };
type Floor = { floorEth: number; floorUsd: number | null };

function formatPrice(price: number) {
  // Sub-cent meme-coin prices need more precision than a currency
  // formatter's default 2 decimals, which would render these as "$0.00".
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toPrecision(3)}`;
}

export default function SiteTicker() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/troll-nft");
        if (!res.ok) return; // keep the last good floor rather than blanking
        const data = await res.json();
        if (!cancelled && Number.isFinite(data?.floorEth)) {
          setFloor({ floorEth: data.floorEth, floorUsd: data.floorUsd ?? null });
        }
      } catch {
        // Offline or blocked — the ticker just runs without a floor.
      }
    }

    load();
    const id = setInterval(load, NFT_POLL_MS);
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
      {/* Rendered only when the USD conversion succeeded. OpenSea quotes the
          floor in ETH, so floorUsd depends on a second (Coinbase) call; with
          the ETH figure no longer shown there is nothing meaningful left to
          display if that conversion is missing, so the entry drops out
          rather than printing a bare label. */}
      {floor && floor.floorUsd !== null ? (
        <>
          {" · "}
          <span className="site-ticker-price">
            NFTs ${Math.round(floor.floorUsd).toLocaleString("en-US")}
          </span>
        </>
      ) : null}
      {/* Non-breaking spaces (U+00A0), NOT plain ones — check the actual
          bytes if you touch this line, since the two are indistinguishable
          on screen and this comment claimed nbsp for a long time while the
          code shipped plain spaces.

          A plain trailing space at the end of a line box is collapsed away
          by inline layout, but the same space mid-line (where another copy
          follows) is preserved. So the LAST copy measured 7.69px narrower
          than the other two (1213.05 vs 1220.73), the track's own width was
          3654.52, and a "one copy" shift of 100%/3 = 1218.17px undershot a
          real copy by 2.56px — every single pass. That error accumulates:
          a frame-by-frame scan of a phone recording caught the seam sliding
          until a 291px band of empty bar sat on the left for ~3.7 seconds,
          and single frames rendering completely blank (the "blink").
          A non-breaking space never collapses, so all three copies measure
          identically and the loop closes exactly. */}
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
      {/* THREE copies, not two. The track shifts by exactly one copy
          (-33.3333%) per loop, so when it snaps back there is always a
          full spare copy already sitting past the right edge of the bar.
          With only two copies the track's trailing edge landed exactly on
          the bar's right edge at the reset frame, and Safari could paint
          that edge for a single composited frame before re-rasterizing —
          a brief blink at the end of every loop. The third copy is pure
          headroom so no reset frame is ever near the track's edge.
          No whitespace between the spans: JSX turns a newline between
          siblings into a real space text node, which under nowrap renders
          between copies and makes them unequal widths. */}
      <div className="site-ticker-track">
        <span className="site-ticker-copy">{unit}</span>
        {/* prettier-ignore */}
        <span className="site-ticker-copy" aria-hidden="true">{unit}</span>
        {/* prettier-ignore */}
        <span className="site-ticker-copy" aria-hidden="true">{unit}</span>
      </div>
    </div>
  );
}
