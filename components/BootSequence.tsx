"use client";

import { useEffect, useState } from "react";
import { BOOT_LINES } from "@/lib/ascii";

const SESSION_KEY = "trollface_booted";
const LINE_DELAY_MS = 220;

// Fake POST/boot text shown once per browser session. Skippable via any
// click/keypress, and skipped entirely for returning-within-session visitors
// so it never gets in the way of actually using the terminal.
export default function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [shownCount, setShownCount] = useState(0);

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
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShownCount((c) => c + 1), LINE_DELAY_MS);
    return () => clearTimeout(t);
  }, [visible, shownCount]);

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
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center px-4">
      <pre className="text-terminal text-xs sm:text-sm leading-relaxed">
        {BOOT_LINES.slice(0, shownCount).join("\n")}
        <span className="blink-cursor" />
      </pre>
    </div>
  );
}
