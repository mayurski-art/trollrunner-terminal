"use client";

import { useEffect, useState } from "react";

// How long the face takes to fade up once the boot text has finished.
export const FACE_REVEAL_MS = 1100;

const SIZE = 360; // display size; the source is 480px so it stays crisp
const IMG_SRC = "/faces/trollface-grin.gif";

// The glyph-grid trollface that closes the boot sequence. This is the real
// terminal-grin artwork (threshold to two tones and reduced from 8.5MB so a
// loading screen isn't itself a slow load), fading up over the boot text.
export default function BootFace({ active }: { active: boolean }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) return;
    // Fade in on the next frame so the transition actually runs rather than
    // the element mounting already-opaque.
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, [active]);

  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!active) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={IMG_SRC}
      alt=""
      aria-hidden="true"
      width={SIZE}
      height={SIZE}
      style={{
        width: SIZE,
        height: SIZE,
        maxWidth: "100%",
        opacity: reduceMotion || shown ? 1 : 0,
        transition: reduceMotion
          ? undefined
          : `opacity ${FACE_REVEAL_MS}ms ease-out`,
      }}
    />
  );
}
