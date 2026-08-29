"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOOT_LINES } from "@/lib/ascii";
import BootConnector, { type ConvergeOrigin } from "@/components/BootConnector";

const LINE_DELAY_MS = 220;
const CONNECTOR_START_DELAY_MS = 250; // beat after the last line before the connector renders
const ZOOM_MS = 2400; // must match the transition duration set in handleConverge
const ZOOM_SCALE = 70;
const FADE_MS = 350;

// Fake POST/boot text shown on every full page load (including a plain
// browser refresh — this remounts the root layout, so no persistence is
// needed or wanted), followed by the 5-node connector
// (components/BootConnector.tsx — carlos, umadbro.shop, NFT, crypto, all
// converging on the trolltruths hub) zooming through its own center into
// the site underneath, which has been mounted the whole time behind this
// fixed overlay. Skippable via any click/keypress. Client-side navigation
// between pages does NOT remount this (the root layout stays mounted
// across routes), so it only replays on an actual reload.
export default function BootSequence() {
  const [visible, setVisible] = useState(false);
  const [shownCount, setShownCount] = useState(0);
  const [phase, setPhase] = useState<"typing" | "connector">("typing");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Deferred to an effect (rather than the initial useState value) so the
    // server-rendered HTML always starts hidden and the client's first
    // paint matches it — avoiding a hydration mismatch — then reveals
    // itself a tick later.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (shownCount >= BOOT_LINES.length) {
      if (phase === "typing") {
        const t = setTimeout(() => setPhase("connector"), CONNECTOR_START_DELAY_MS);
        return () => clearTimeout(t);
      }
      return; // dismissal from here on is driven by handleConverge's zoom, not a timer
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

  // The payoff: zoom the whole overlay through the exact point the
  // connector just flared at, then fade what's now a huge, off-screen-
  // edged wash of color out to reveal the site — which was mounted behind
  // this fixed overlay the entire time — before finally unmounting.
  const handleConverge = useCallback(({ x, y }: ConvergeOrigin) => {
    const overlay = overlayRef.current;
    if (!overlay) {
      setVisible(false);
      return;
    }
    overlay.style.transformOrigin = `${x}px ${y}px`;
    overlay.style.transition = `transform ${ZOOM_MS}ms cubic-bezier(.6,0,.85,0)`;
    requestAnimationFrame(() => {
      overlay.style.transform = `scale(${ZOOM_SCALE})`;
    });
    setTimeout(() => {
      overlay.style.transition = `opacity ${FADE_MS}ms ease`;
      overlay.style.opacity = "0";
    }, ZOOM_MS - 200);
    setTimeout(() => setVisible(false), ZOOM_MS + FADE_MS);
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-4 px-4"
    >
      <pre className="text-terminal text-xs sm:text-sm leading-relaxed">
        {BOOT_LINES.slice(0, shownCount).join("\n")}
        {phase === "typing" && <span className="blink-cursor" />}
      </pre>
      {phase === "connector" && (
        <BootConnector onConverge={handleConverge} totalMs={ZOOM_MS + FADE_MS} />
      )}
    </div>
  );
}
