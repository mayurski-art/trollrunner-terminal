"use client";

import { useEffect, useRef, useState } from "react";

// Custom terminal-styled cursor, fine-pointer devices only (mouse/trackpad —
// see the .chat-scroll rule in globals.css for the same pointer:fine gate).
// A small dot tracks the real cursor 1:1; a trailing ring eases toward it
// for a bit of drag. Hovering anything clickable swaps both to the
// "targeting" look — bigger ring, filled dot — so the cross-hair reads as
// live feedback rather than decoration. The OS cursor is hidden via
// `cursor: none` in globals.css only while this is mounted (see the
// data-custom-cursor attribute it sets on <html>), so nothing goes fully
// invisible if JS is off or this bails out on a coarse pointer.
const CLICKABLE_SELECTOR =
  'a, button, input, textarea, select, [role="button"], [onclick], label, summary';

export default function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  // Detect pointer:fine once on mount. This only flips `enabled` — it can't
  // also wire up listeners here, since the dot/ring divs don't exist yet
  // (the component still returns null on this same render) and refs would
  // read null. The second effect below runs after the re-render that
  // follows setEnabled(true), once the refs actually point at real nodes.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    document.documentElement.setAttribute("data-custom-cursor", "");

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;
    let raf = 0;

    // Paint at center immediately instead of waiting for the first
    // mousemove — without this the dot/ring sit at their CSS default
    // (0,0, i.e. the top-left corner) until the pointer first moves.
    dot.style.transform = `translate(${mouseX}px, ${mouseY}px)`;
    ring.style.transform = `translate(${ringX}px, ${ringY}px)`;

    function onMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot!.style.transform = `translate(${mouseX}px, ${mouseY}px)`;

      const target = e.target as Element | null;
      const isClickable = !!target?.closest(CLICKABLE_SELECTOR);
      ring!.classList.toggle("cursor-ring--active", isClickable);
      dot!.classList.toggle("cursor-dot--active", isClickable);
    }

    function onDown() {
      ring!.classList.add("cursor-ring--down");
    }
    function onUp() {
      ring!.classList.remove("cursor-ring--down");
    }
    function onLeave() {
      dot!.style.opacity = "0";
      ring!.style.opacity = "0";
    }
    function onEnter() {
      dot!.style.opacity = "1";
      ring!.style.opacity = "1";
    }

    // Ring eases toward the real position instead of snapping — the drag is
    // what makes it read as a distinct trailing element rather than a
    // second copy of the dot.
    function tick() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring!.style.transform = `translate(${ringX}px, ${ringY}px)`;
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
      cancelAnimationFrame(raf);
      document.documentElement.removeAttribute("data-custom-cursor");
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true" />
    </>
  );
}
