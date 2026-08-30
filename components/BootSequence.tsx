"use client";

import { useCallback, useEffect, useState } from "react";
import { BOOT_LINES } from "@/lib/ascii";
import BootConnector from "@/components/BootConnector";

const LINE_DELAY_MS = 220;
const CONNECTOR_START_DELAY_MS = 250; // beat after the last line before the connector renders
const REVEAL_MS = 2400; // total span from convergence to the overlay unmounting — drives the traffic-light timing in BootConnector
const FADE_MS = 350;

// Fake POST/boot text shown on every full page load (including a plain
// browser refresh — this remounts the root layout, so no persistence is
// needed or wanted), followed by the 5-node connector
// (components/BootConnector.tsx — carlos, umadbro.shop, NFT, crypto, all
// converging on the trolltruths hub) running its device-border traffic
// light (red -> yellow -> green) before fading out to reveal the site,
// which has been mounted the whole time behind this fixed overlay. Not
// user-skippable — it always plays out in full. Client-side navigation
// between pages does NOT remount this (the root layout stays mounted
// across routes), so it only replays on an actual reload.
export default function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [shownCount, setShownCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "connector" | "fading">("typing");

  useEffect(() => {
    // Deferred to an effect (rather than the initial useState value) so the
    // server-rendered HTML always starts hidden and the client's first
    // paint matches it — avoiding a hydration mismatch — then reveals
    // itself a tick later.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  // Hand over from the server-rendered #preboot-shield (app/layout.tsx),
  // which has been covering the site since the very first paint. Waiting two
  // frames means the overlay below has actually been painted before the
  // shield stops hiding things, so there's no frame in between where the
  // real site is on screen.
  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document.documentElement.setAttribute("data-boot-ready", ""),
      ),
    );
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (shownCount >= BOOT_LINES.length) {
      if (phase === "typing") {
        const t = setTimeout(() => setPhase("connector"), CONNECTOR_START_DELAY_MS);
        return () => clearTimeout(t);
      }
      return; // dismissal from here on is driven by handleConverge's timers, not this effect
    }
    const t = setTimeout(() => setShownCount((c) => c + 1), LINE_DELAY_MS);
    return () => clearTimeout(t);
  }, [visible, shownCount, phase]);

  // Pull the connector's art down while the text is still typing so it's
  // ready the moment the sequence hands over to it.
  useEffect(() => {
    if (!visible) return;
    new Image().src = "/boot/carlos-ramirez.webp";
    new Image().src = "/boot/umadbro.jpg";
    new Image().src = "/boot/troll-nft.jpg";
    new Image().src = "/boot/troll-crypto.jpg";
    new Image().src = "/boot/trollface-grin.svg";
  }, [visible]);

  // The payoff: once the connector's traffic light reaches green, simply
  // fade the overlay out to reveal the site — which was mounted behind it
  // the entire time — before finally unmounting. No zoom, no transform.
  const handleConverge = useCallback(() => {
    setTimeout(() => setPhase("fading"), REVEAL_MS);
    setTimeout(() => setVisible(false), REVEAL_MS + FADE_MS);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 px-4${
        phase === "fading" ? " boot-fade-out" : ""
      }`}
      style={{ transition: `opacity ${FADE_MS}ms ease` }}
    >
      <pre className="text-terminal text-xs sm:text-sm leading-relaxed">
        {BOOT_LINES.slice(0, shownCount).join("\n")}
        <span className={`blink-cursor${phase === "typing" ? "" : " is-done"}`} />
      </pre>
      {phase !== "typing" && (
        <BootConnector onConverge={handleConverge} totalMs={REVEAL_MS} />
      )}
    </div>
  );
}
