"use client";

import { useEffect, useRef, useState } from "react";

type BannerProps = {
  art: string;
  label: string; // real text for screen readers
  tone?: "terminal" | "alert";
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

export default function Banner({ art, label, tone = "terminal" }: BannerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [fontSize, setFontSize] = useState(BASE_FONT_PX);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pre = preRef.current;
    if (!wrapper || !pre) return;

    function recalc() {
      if (!wrapper || !pre) return;
      const availableWidth = wrapper.clientWidth;
      const currentWidth = pre.scrollWidth;
      if (currentWidth <= 0) return;
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
      const next = Math.round(Math.max(MIN_FONT_PX, Math.min(BASE_FONT_PX, rawSize)));
      setFontSize((prev) => (next === prev ? prev : next));
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [art]);

  return (
    <div ref={wrapperRef} className="w-full overflow-hidden">
      <h1 className="sr-only">{label}</h1>
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
