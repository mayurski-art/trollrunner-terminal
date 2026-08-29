"use client";

import { useEffect, useRef } from "react";

const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
const SPIN_INTERVAL_MS = 650; // gap between the start of one spin and the next
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

// The persistent connector widget in the [ speak to it ] panel header —
// trolltruths as the hub, one horizontal row, spokes to every source/persona
// feeding it: carlos (the art), umadbro.shop (the merch arm), the NFT
// collection, the troll-crypto coin. Deliberately stays a single row rather
// than the radial hub-and-spoke used for planning — same visual language as
// BootConnector.tsx (components/BootConnector.tsx), but ambient/looping and
// horizontal, not a one-shot reveal.
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
      <div className="mc-grid">
        <div className="mc-col mc-col--carlos">
          <div className="mc-node">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/boot/carlos-ramirez.webp" alt="Carlos Ramirez" />
          </div>
          <div className="mc-label">carlos</div>
        </div>

        <div className="mc-col mc-col--umadbro">
          <div className="mc-node">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/boot/umadbro.jpg" alt="UMadBro" />
          </div>
          <div className="mc-label">umadbro.shop</div>
        </div>

        <div className="mc-col mc-col--hub">
          <div className="mc-hub-ring">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={faceRef} src={FACE_GRIN} alt="TrollTruths" />
          </div>
          <div className="mc-label">trolltruths</div>
        </div>

        <div className="mc-col mc-col--nft">
          <div className="mc-node">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/boot/troll-nft.jpg" alt="Troll NFT" />
          </div>
          <div className="mc-label">NFT</div>
        </div>

        <div className="mc-col mc-col--crypto">
          <div className="mc-node">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/boot/troll-crypto.jpg" alt="Troll crypto" />
          </div>
          <div className="mc-label">crypto</div>
        </div>
      </div>

      <div className="mc-wire-row">
        <div className="mc-wire-line" />
        <div className="mc-packet mc-packet--carlos" />
        <div className="mc-packet mc-packet--umadbro" />
        <div className="mc-packet mc-packet--nft" />
        <div className="mc-packet mc-packet--crypto" />
      </div>
    </div>
  );
}
