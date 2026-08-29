"use client";

import { useEffect, useRef } from "react";

const START_YOU = 19.2308; // see the matching CSS comment in globals.css
const START_IT = 80.7692;
const MID = 50;
const CRAWL_MS = 1100;
const RED_HOLD_MS = 350; // how long it sits solid red before easing toward green

export type ConvergeOrigin = { x: number; y: number };

// The boot sequence's closing beat, replacing the old static grin fade-in:
// Carlos (the artist, docs/carlos ramirez.webp) and the trollface converge
// toward a center node once. The instant they meet it flares red and
// reports its screen position via onConverge — BootSequence uses that as
// the transform-origin for the zoom that reveals the actual site. The
// center then rides red -> green over `revealMs`, landing on green right
// as BootSequence's fade-out actually unveils the site underneath — a
// stop/go cue timed to the reveal, not just a color for its own sake.
export default function BootConnector({
  onConverge,
  revealMs,
}: {
  onConverge: (origin: ConvergeOrigin) => void;
  revealMs: number;
}) {
  const packetYouRef = useRef<HTMLDivElement>(null);
  const packetItRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const packetYou = packetYouRef.current;
    const packetIt = packetItRef.current;
    const center = centerRef.current;
    if (!packetYou || !packetIt || !center) return;

    packetYou.style.left = `${START_YOU}%`;
    packetIt.style.left = `${START_IT}%`;
    packetYou.style.opacity = "1";
    packetIt.style.opacity = "1";

    const raf = requestAnimationFrame(() => {
      packetYou.style.transition = `left ${CRAWL_MS}ms linear`;
      packetIt.style.transition = `left ${CRAWL_MS}ms linear`;
      packetYou.style.left = `${MID}%`;
      packetIt.style.left = `${MID}%`;
    });

    let greenTimer: ReturnType<typeof setTimeout> | undefined;

    const convergeTimer = setTimeout(() => {
      packetYou.style.opacity = "0";
      packetIt.style.opacity = "0";
      center.style.transition = "none";
      center.style.background = "var(--alert)";
      center.style.boxShadow =
        "0 0 16px var(--alert), 0 0 60px var(--alert), 0 0 120px var(--alert)";

      const rect = center.getBoundingClientRect();
      onConverge({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

      // hold solid red for a beat, then ease to green over whatever time
      // remains, so it still lands exactly when the site unveils
      const easeMs = Math.max(0, revealMs - RED_HOLD_MS);
      greenTimer = setTimeout(() => {
        center.style.transition = `background-color ${easeMs}ms ease, box-shadow ${easeMs}ms ease`;
        center.style.background = "var(--bc-go)";
        center.style.boxShadow =
          "0 0 16px var(--bc-go), 0 0 60px var(--bc-go), 0 0 120px var(--bc-go)";
      }, RED_HOLD_MS);
    }, CRAWL_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(convergeTimer);
      clearTimeout(greenTimer);
    };
  }, [onConverge, revealMs]);

  return (
    <div className="boot-connector">
      <div className="bc-node bc-node--you">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/carlos-ramirez.webp" alt="" />
      </div>
      <div className="bc-node bc-node--it">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/trollface-grin.png" alt="" />
      </div>

      <div className="bc-stems">
        <div className="bc-stem" />
      </div>
      <div className="bc-stems">
        <div className="bc-stem" />
      </div>

      <div className="bc-wire-row">
        <div className="bc-wire-line" />
        <div ref={packetYouRef} className="bc-packet bc-packet--you" />
        <div ref={packetItRef} className="bc-packet bc-packet--it" />
        <div ref={centerRef} className="bc-center" />
      </div>

      <div className="bc-labels bc-labels--you">carlos</div>
      <div className="bc-labels bc-labels--it">trolltruths</div>
    </div>
  );
}
