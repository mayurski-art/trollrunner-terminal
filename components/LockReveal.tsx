"use client";

import { useEffect } from "react";

// The padlock a sealed lore file shows, and the short animation it plays
// when a PROBLEM opens it: the body rattles, the shackle springs up and
// swings open, then the whole lock fades out (.lock-reveal-* in
// globals.css). Drawn in CSS so it scales with font-size: `size` is in em,
// so the archive list can use a small inline one and the NEW FILE popup a
// big one.
//
// `opening` starts the animation; `onOpened` fires when it finishes (right
// away under reduced motion, where the lock just snaps open).
export const LOCK_OPEN_MS = 950;

export default function LockReveal({
  opening,
  onOpened,
  size = 1,
  className = "",
}: {
  opening: boolean;
  onOpened?: () => void;
  size?: number;
  className?: string;
}) {
  useEffect(() => {
    if (!opening || !onOpened) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(onOpened, reduced ? 150 : LOCK_OPEN_MS);
    return () => clearTimeout(t);
  }, [opening, onOpened]);

  return (
    <span
      aria-hidden="true"
      className={`lock-reveal ${opening ? "lock-reveal-opening" : ""} ${className}`}
      style={{ fontSize: `${size}em` }}
    >
      <span className="lock-reveal-shackle" />
      <span className="lock-reveal-body">
        <span className="lock-reveal-keyhole" />
      </span>
    </span>
  );
}
