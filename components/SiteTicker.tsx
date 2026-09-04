"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
  const trackRef = useRef<HTMLDivElement>(null);
  const firstCopyRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/troll-price");
        if (!res.ok) return; // keep the last good quote rather than blanking
        const data = await res.json();
        if (!cancelled && Number.isFinite(data?.priceUsd)) {
          // Only swap in a NEW object when a displayed value actually
          // changed. setQuote({...}) unconditionally would hand React a
          // fresh reference on every 60s poll, re-running the measuring
          // layout effect (and, when it still restarted the animation,
          // visibly snapping the ticker back to the seam) even though the
          // rendered text was identical.
          setQuote((prev) =>
            prev &&
            prev.priceUsd === data.priceUsd &&
            prev.change24h === (data.change24h ?? null)
              ? prev
              : { priceUsd: data.priceUsd, change24h: data.change24h ?? null },
          );
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
          // Same identity guard as the quote above — an unchanged floor must
          // not produce a new object, or it re-runs the layout effect.
          setFloor((prev) =>
            prev &&
            prev.floorEth === data.floorEth &&
            prev.floorUsd === (data.floorUsd ?? null)
              ? prev
              : { floorEth: data.floorEth, floorUsd: data.floorUsd ?? null },
          );
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

  // Publish the width of ONE copy as --ticker-shift, so the keyframe can
  // translate by a fixed pixel distance instead of a percentage of the
  // track. The track's width is not stable: it paints first with no market
  // data and grows when the $TROLL quote and NFT floor arrive, and a
  // percentage transform silently re-resolves against that new width,
  // teleporting a running animation sideways by up to a full copy (that
  // jump is the "blink", and where it lands is the "gap"). Re-measured
  // whenever the content changes, on resize, and after webfonts load, since
  // all three change the text's rendered width.
  //
  // useLayoutEffect so the variable is set in the same frame the new content
  // paints — with a plain effect the browser can paint one frame using the
  // stale shift, which is the very jump this exists to prevent.
  useLayoutEffect(() => {
    const track = trackRef.current;
    const copy = firstCopyRef.current;
    if (!track || !copy) return;

    const apply = () => {
      const w = copy.getBoundingClientRect().width;
      if (!w) return;
      // Write the variable ONLY — never restart the animation here.
      //
      // This used to do the animation:none / reflow / animation:"" restart
      // dance, which by construction sets currentTime back to 0: if the
      // track was mid-scroll it snapped to the seam, a hard visible jump.
      // Combined with the 60s price poll handing React a new object every
      // time, that fired about once a minute — the remaining "blink" after
      // the gap was fixed.
      //
      // No restart is needed. A CSS custom property is live: the running
      // animation re-reads --ticker-shift on its next frame and simply
      // interpolates toward the new distance, so the scroll stays
      // continuous. A width change is also rare (only when the price text
      // actually changes length) and small, so the retarget is imperceptible
      // — and infinitely preferable to a guaranteed jump back to zero.
      const prev = track.style.getPropertyValue("--ticker-shift");
      const next = `${w}px`;
      if (prev !== next) track.style.setProperty("--ticker-shift", next);
    };

    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(copy);
    window.addEventListener("resize", apply);
    // Webfonts swapping in after first paint change the measured width.
    document.fonts?.ready.then(apply).catch(() => {});
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, [quote, floor]);

  // Build the market segments as PLAIN STRINGS, not conditional JSX subtrees.
  //
  // This is what was left of the blink once the geometry was proven seamless.
  // A frame-by-frame scan of the reported recording found exactly one real
  // ticker blink in 21s: at t=15.40s the row went to zero ink for a SINGLE
  // frame and then resumed at the same scroll position (firstX 23 -> blank
  // -> 22). Nothing moved, so it was never the seam, the reset, or the layer
  // size — the text simply was not painted for one frame.
  //
  // The cause is reconciliation. `unit` was a JSX fragment full of
  // conditional subtrees, and the SAME element object was rendered into all
  // three copies. When the price or floor arrived, React tore down and
  // rebuilt those <span>s inside every copy at once; with line-height:0 on
  // the bar, an inline formatting context that is momentarily empty paints
  // as nothing for that frame.
  //
  // Strings interpolated into a stable element tree change nothing but
  // character data, so there is no subtree to unmount and nothing can be
  // unpainted mid-swap.
  const priceText = quote ? ` · $TROLL ${formatPrice(quote.priceUsd)}` : "";
  // Kept separate from priceText so it can carry the gain/loss colour on an
  // always-present span. Direction reads from the arrow glyph as well as the
  // colour, so it does not rely on colour alone.
  const changeText =
    quote && quote.change24h !== null
      ? ` ${quote.change24h >= 0 ? "▲" : "▼"}${Math.abs(quote.change24h).toFixed(2)}%`
      : "";
  const floorText =
    floor && floor.floorUsd !== null
      ? ` · NFTs $${Math.round(floor.floorUsd).toLocaleString("en-US")}`
      : "";
  // Colour the change indicator without letting its class toggle remount
  // anything: the class is on a span that is always present, and only its
  // text and className change.
  const changeClass =
    quote && quote.change24h !== null
      ? quote.change24h >= 0
        ? "site-ticker-up"
        : "site-ticker-down"
      : "";

  const unit = (
    <>
      {TICKER_TEXT}
      <span className="site-ticker-price">{priceText}</span>
      <span className={changeClass}>{changeText}</span>
      <span className="site-ticker-price">{floorText}</span>
      {/* The floor is rendered above, as floorText, only when the USD
          conversion succeeded. OpenSea quotes the floor in ETH, so floorUsd
          depends on a second (Coinbase) call; with the ETH figure no longer
          shown there is nothing meaningful left to display if that
          conversion is missing, so the entry becomes an empty string rather
          than printing a bare label. An empty string keeps the span mounted,
          which is the whole point — see the note above the strings. */}
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
      <div className="site-ticker-track" ref={trackRef}>
        <span className="site-ticker-copy" ref={firstCopyRef}>{unit}</span>
        {/* prettier-ignore */}
        <span className="site-ticker-copy" aria-hidden="true">{unit}</span>
        {/* prettier-ignore */}
        <span className="site-ticker-copy" aria-hidden="true">{unit}</span>
      </div>
    </div>
  );
}
