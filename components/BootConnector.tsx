"use client";

import { useEffect, useRef } from "react";

const START_YOU = 19.2308; // see the matching CSS comment in globals.css
const START_IT = 80.7692;
const MID = 50;
const CRAWL_MS = 1100;
const RED_PCT = 0.2; // fraction of the total color sequence spent red
const YELLOW_PCT = 0.25; // fraction spent yellow — green claims the rest
const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
const SPIN_INTERVAL_MS = 650; // gap between the start of one spin and the next
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

export type ConvergeOrigin = { x: number; y: number };

// The boot sequence's closing beat, replacing the old static grin fade-in:
// Carlos (the artist, docs/carlos ramirez.webp) and the trollface converge
// toward a center node once. The instant they meet it flares red and
// reports its screen position via onConverge — BootSequence uses that as
// the transform-origin for the zoom that reveals the actual site. The
// center then runs an actual traffic-light sequence — red, then yellow,
// then green — split as RED_PCT/YELLOW_PCT/remainder of `totalMs`, the
// full span from convergence to BootSequence unmounting the overlay. A
// stop/go cue over the whole reveal, not just a flash at the end of it.
export default function BootConnector({
  onConverge,
  totalMs,
}: {
  onConverge: (origin: ConvergeOrigin) => void;
  totalMs: number;
}) {
  const packetYouRef = useRef<HTMLDivElement>(null);
  const packetItRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const packetYou = packetYouRef.current;
    const packetIt = packetItRef.current;
    const center = centerRef.current;
    const face = faceRef.current;
    if (!packetYou || !packetIt || !center || !face) return;

    // One horizontal turn, swapping the image mid-turn while it's edge-on
    // and briefly invisible — reads as the face turning to reveal the
    // other expression, not a crossfade.
    function spinTo(src: string) {
      if (!face) return;
      face.classList.remove("bc-spinning");
      void face.offsetWidth; // restart the animation from scratch
      face.classList.add("bc-spinning");
      setTimeout(() => {
        if (face) face.src = src;
      }, SPIN_MS / 2);
    }

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

    const setLight = (color: string) => {
      center.style.transition = "none";
      center.style.background = color;
      center.style.boxShadow = `0 0 16px ${color}, 0 0 60px ${color}, 0 0 120px ${color}`;
    };

    let yellowTimer: ReturnType<typeof setTimeout> | undefined;
    let greenTimer: ReturnType<typeof setTimeout> | undefined;
    let spinInterval: ReturnType<typeof setInterval> | undefined;

    const convergeTimer = setTimeout(() => {
      packetYou.style.opacity = "0";
      packetIt.style.opacity = "0";
      setLight("var(--alert)"); // red

      const rect = center.getBoundingClientRect();
      onConverge({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

      // the face keeps turning, grin <-> worry, for as long as this stays
      // mounted — not a one-off reaction, a running tell
      let currentFace = FACE_GRIN;
      const spinNext = () => {
        currentFace = currentFace === FACE_GRIN ? FACE_SAD : FACE_GRIN;
        spinTo(currentFace);
      };
      spinNext();
      spinInterval = setInterval(spinNext, SPIN_INTERVAL_MS);

      // red -> yellow -> green, split 20% / 25% / 55% of the total
      // sequence — a real sequence, not a red/green blend
      const redHold = totalMs * RED_PCT;
      const yellowHold = totalMs * YELLOW_PCT;
      yellowTimer = setTimeout(() => setLight("var(--problem)"), redHold);
      greenTimer = setTimeout(() => setLight("var(--bc-go)"), redHold + yellowHold);
    }, CRAWL_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(convergeTimer);
      clearTimeout(yellowTimer);
      clearTimeout(greenTimer);
      clearInterval(spinInterval);
    };
  }, [onConverge, totalMs]);

  return (
    <div className="boot-connector">
      <div className="bc-node bc-node--you">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/carlos-ramirez.webp" alt="" />
      </div>
      <div className="bc-node bc-node--it">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={faceRef} src={FACE_GRIN} alt="" />
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
