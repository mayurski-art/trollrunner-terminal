"use client";

import { useEffect, useRef } from "react";

const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
const SPIN_INTERVAL_MS = 650; // gap between the start of one spin and the next
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

// The persistent "carlos <-> trolltruths" widget in the [ speak to it ]
// panel — Carlos (the artist) and the trollface, pulsing forever, same
// visual language as the boot sequence's connector (components/BootConnector.tsx)
// but ambient/looping rather than a one-shot reveal.
export default function MiniConnector() {
  const faceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const face = faceRef.current;
    if (!face) return;

    let currentFace = FACE_GRIN;
    const spinNext = () => {
      currentFace = currentFace === FACE_GRIN ? FACE_SAD : FACE_GRIN;
      face.classList.remove("mc-spinning");
      void face.offsetWidth; // restart the animation from scratch
      face.classList.add("mc-spinning");
      setTimeout(() => {
        face.src = currentFace;
      }, SPIN_MS / 2);
    };

    const interval = setInterval(spinNext, SPIN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mini-connector">
      <div className="mc-node mc-node--you">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/carlos-ramirez.webp" alt="" />
      </div>

      <div className="mc-wire">
        <div className="mc-wire-line" />
        <div className="mc-packet mc-packet--l" />
        <div className="mc-packet mc-packet--r" />
        <div className="mc-dot" />
      </div>

      <div className="mc-node mc-node--it">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={faceRef} src={FACE_GRIN} alt="" />
      </div>

      <div className="mc-labels">
        <span>carlos</span>
        <span>&middot;</span>
        <span>trolltruths</span>
      </div>
    </div>
  );
}
