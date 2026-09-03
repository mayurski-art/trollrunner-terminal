"use client";

// Placeholder "who you're talking to" glyph above the chat. Modeled on the
// header face at imfebu.com/rent (their "ven" entity uses (⌐■_□), captured
// via screen recording 2026-09-02): each eye toggles between filled (■) and
// hollow (□) independently, on its own timer, offset from the other eye —
// two asynchronous blinking cursors rather than a synchronized blink. This
// is a stand-in built from plain characters; the intent is to swap it for a
// trollface-styled version (drawn frames or a small sprite) once that art
// exists — the eye-toggle rhythm below is the part worth keeping either way.
import { useEffect, useState } from "react";

const EYE_FILLED = "■";
const EYE_HOLLOW = "□";

// Each eye holds its state ~1-1.5s before flipping, staggered so only one
// eye changes at a time — matches the captured cadence closely enough
// without hardcoding a literal frame-for-frame replay.
function scheduleEye(setFilled: (updater: (v: boolean) => boolean) => void): () => void {
  let timeout: ReturnType<typeof setTimeout>;
  const tick = () => {
    setFilled((v) => !v);
    timeout = setTimeout(tick, 1000 + Math.random() * 500);
  };
  timeout = setTimeout(tick, 1000 + Math.random() * 500);
  return () => clearTimeout(timeout);
}

export default function TerminalFace() {
  const [leftFilled, setLeftFilled] = useState(false);
  const [rightFilled, setRightFilled] = useState(true);

  useEffect(() => {
    const stopLeft = scheduleEye(setLeftFilled);
    // Right eye starts on its own offset timer so the two never sync up.
    let stopRight: () => void = () => {};
    const startRight = setTimeout(() => {
      stopRight = scheduleEye(setRightFilled);
    }, 600);
    return () => {
      stopLeft();
      clearTimeout(startRight);
      stopRight();
    };
  }, []);

  return (
    <span
      className="text-terminal font-mono select-none"
      style={{ textShadow: "0 0 6px color-mix(in srgb, var(--terminal) 55%, transparent)" }}
      aria-hidden="true"
      title="trollface terminal"
    >
      {`(⌐${leftFilled ? EYE_FILLED : EYE_HOLLOW}_${rightFilled ? EYE_FILLED : EYE_HOLLOW})`}
    </span>
  );
}
