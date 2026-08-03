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
// Fits the banner to its container by measuring the pre's natural size and
// applying a CSS transform: scale() — never lets it overflow, so there is
// never a scrollbar to fight with (a viewport-relative font-size clamp
// looked fine at some widths and garbled/scrollbar-ridden at others).
//
// Below MIN_SCALE the dense, multi-stroke "ANSI Shadow" glyphs turn to mush
// when shrunk, so scale never drops below that floor — on a viewport too
// narrow even for the floor, the rare fallback is a horizontal scroll on
// that one banner, never an illegibly tiny render.
const MIN_SCALE = 0.55;

export default function Banner({ art, label, tone = "terminal" }: BannerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [scale, setScale] = useState(1);
  const [naturalHeight, setNaturalHeight] = useState(0);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pre = preRef.current;
    if (!wrapper || !pre) return;

    function recalc() {
      if (!wrapper || !pre) return;
      const availableWidth = wrapper.clientWidth;
      const naturalWidth = pre.scrollWidth;
      const height = pre.scrollHeight;
      const rawScale = naturalWidth > 0 ? availableWidth / naturalWidth : 1;
      const clamped = Math.min(1, Math.max(rawScale, MIN_SCALE));
      setScale(clamped);
      setNeedsScroll(rawScale < MIN_SCALE);
      setNaturalHeight(height);
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [art]);

  return (
    <div
      ref={wrapperRef}
      className={`w-full ${needsScroll ? "overflow-x-auto" : "overflow-hidden"}`}
      style={{ height: naturalHeight * scale || undefined }}
    >
      <h1 className="sr-only">{label}</h1>
      <pre
        ref={preRef}
        aria-hidden="true"
        className={`ascii-banner ${tone === "alert" ? "ascii-banner--alert" : ""}`}
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {art}
      </pre>
    </div>
  );
}
