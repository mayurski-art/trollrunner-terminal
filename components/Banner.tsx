"use client";

import { useEffect, useRef, useState } from "react";

type BannerProps = {
  art: string;
  // Optional wider single-line variant shown at desktop widths instead of
  // `art` — see BANNER_TROLLFACE_WIDE in lib/ascii.ts for why this exists.
  wideArt?: string;
  label: string; // real text for screen readers
  tone?: "terminal" | "alert";
  maxFontPx?: number;
  // Cap for `wideArt` specifically. Desktop containers are much wider, so
  // reusing `maxFontPx` there forces a needlessly small font-size — and
  // small sizes are exactly where per-glyph sub-pixel advance-width drift
  // becomes visible (it shows up as doubled/misaligned strokes, worst on
  // the box-drawing-heavy "S"). Defaults to maxFontPx if not given.
  wideMaxFontPx?: number;
};

// Renders a FIGlet banner from lib/ascii.ts. The <pre> block is aria-hidden
// so screen readers never read hundreds of box-drawing characters — a
// visually-hidden heading carries the real text instead.
//
// Fits the banner to its container by measuring the pre's natural width at
// the base font-size and re-setting font-size directly (never a CSS
// transform: scale()). Scaling a dense, multi-stroke glyph set with
// transform blurs every sub-pixel edge — that's what made these banners
// look thick and mushy. Resizing the actual font-size lets the browser
// re-hint the glyphs at every width, and since it always shrinks to fit,
// there's never an overflow to scroll.
const BASE_FONT_PX = 22; // matches --font-size: 1.375rem in .ascii-banner
const MIN_FONT_PX = 7; // floor so tiny viewports don't get unreadable text

function useFitFontSize(cap: number) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [fontSize, setFontSize] = useState(cap);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pre = preRef.current;
    if (!wrapper || !pre) return;

    function recalc() {
      if (!wrapper || !pre) return;
      // A hidden (display:none via CSS breakpoint) element reports 0 for
      // both widths — skip so we don't clamp fontSize to MIN_FONT_PX while
      // this variant isn't even the one being shown.
      if (wrapper.offsetParent === null) return;
      const availableWidth = wrapper.clientWidth;
      const currentWidth = pre.scrollWidth;
      if (currentWidth <= 0 || availableWidth <= 0) return;
      // scrollWidth is measured at whatever font-size is currently applied
      // (not BASE_FONT_PX), so back out the size that would make it fit —
      // scale-invariant, so it converges in one step instead of drifting.
      const currentFontPx = parseFloat(getComputedStyle(pre).fontSize) || BASE_FONT_PX;
      const rawSize = currentFontPx * (availableWidth / currentWidth);
      // Box-drawing glyphs (█ ╗ ╝ ═ ║) only tile seam-free when every glyph
      // hints to the same integer pixel grid. A fractional font-size makes
      // adjacent glyphs hint slightly differently, and each OS's subpixel
      // antialiasing renders that misalignment as red/cyan fringing at the
      // seams — differently per device. Rounding to a whole pixel keeps the
      // grid aligned everywhere.
      const next = Math.round(Math.max(MIN_FONT_PX, Math.min(cap, rawSize)));
      setFontSize((prev) => (next === prev ? prev : next));
    }

    recalc();
    // The self-hosted banner font loads with font-display: swap, so the
    // first recalc can run against a fallback font's metrics before the
    // real one swaps in — re-measure once it's actually ready.
    document.fonts?.ready.then(recalc);
    const ro = new ResizeObserver(recalc);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [cap]);

  return { wrapperRef, preRef, fontSize };
}

function FitBanner({
  art,
  cap,
  tone,
  className,
}: {
  art: string;
  cap: number;
  tone: "terminal" | "alert";
  className?: string;
}) {
  const { wrapperRef, preRef, fontSize } = useFitFontSize(cap);
  return (
    <div ref={wrapperRef} className={`w-full overflow-hidden ${className ?? ""}`}>
      <pre
        ref={preRef}
        aria-hidden="true"
        className={`ascii-banner ${tone === "alert" ? "ascii-banner--alert" : ""}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {art}
      </pre>
    </div>
  );
}

// Renders a FIGlet banner from lib/ascii.ts. The <pre> block(s) are
// aria-hidden so screen readers never read hundreds of box-drawing
// characters — a visually-hidden heading carries the real text instead.
//
// When `wideArt` is given, two independently-fitted banners are rendered —
// the stacked/narrow `art` shown below the `md` breakpoint, the single-line
// `wideArt` shown at `md` and up — toggled with CSS (not JS) so there's no
// hydration mismatch and no flash of the wrong variant.
export default function Banner({
  art,
  wideArt,
  label,
  tone = "terminal",
  maxFontPx,
  wideMaxFontPx,
}: BannerProps) {
  const cap = maxFontPx ?? BASE_FONT_PX;
  const wideCap = wideMaxFontPx ?? cap;

  return (
    <div className="w-full">
      <h1 className="sr-only">{label}</h1>
      {wideArt ? (
        <>
          <FitBanner art={art} cap={cap} tone={tone} className="md:hidden" />
          <FitBanner art={wideArt} cap={wideCap} tone={tone} className="hidden md:block" />
        </>
      ) : (
        <FitBanner art={art} cap={cap} tone={tone} />
      )}
    </div>
  );
}
