"use client";

import { useEffect, useState } from "react";
import { BOOT_LINES } from "@/lib/ascii";
import BootFace, { FACE_REVEAL_MS } from "@/components/BootFace";

const SESSION_KEY = "trollface_booted";
const LINE_DELAY_MS = 220;
const FACE_START_DELAY_MS = 250; // beat after the last line before the face renders
const FACE_HOLD_MS = 500; // pause on the finished face before dismissing

// Fake POST/boot text shown once per browser session, followed by a
// dithered-glyph render of the trollface. Skippable via any click/keypress,
// and skipped entirely for returning-within-session visitors so it never
// gets in the way of actually using the terminal.
export default function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [shownCount, setShownCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "face">("typing");

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    // One-time reveal gated on a browser-only API (sessionStorage) that
    // can't be read during render for SSR — a deliberate exception to the
    // "no setState in effect body" guideline.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (shownCount >= BOOT_LINES.length) {
      if (phase === "typing") {
        const t = setTimeout(() => setPhase("face"), FACE_START_DELAY_MS);
        return () => clearTimeout(t);
      }
      const t = setTimeout(
        () => setVisible(false),
        FACE_REVEAL_MS + FACE_HOLD_MS
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShownCount((c) => c + 1), LINE_DELAY_MS);
    return () => clearTimeout(t);
  }, [visible, shownCount, phase]);

  // Pull the face down while the text is still typing so it's ready the
  // moment the sequence hands over to it.
  useEffect(() => {
    if (!visible) return;
    new Image().src = "/faces/trollface-grin.gif";
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const skip = () => setVisible(false);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("click", skip, { once: true });
    return () => {
      window.removeEventListener("keydown", skip);
      window.removeEventListener("click", skip);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 px-4">
      <pre className="text-terminal text-xs sm:text-sm leading-relaxed">
        {BOOT_LINES.slice(0, shownCount).join("\n")}
        {phase === "typing" && <span className="blink-cursor" />}
      </pre>
      <BootFace active={phase === "face"} />
    </div>
  );
}
