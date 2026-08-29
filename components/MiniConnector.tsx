"use client";

import { useEffect, useRef } from "react";

const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
// Must match the packet keyframes' full loop length in globals.css
// (.mc-packet-out--* / .mc-packet-in--* animations) — half of it is the
// colored leg (node -> hub), half the grey leg (hub -> node), and the face
// flips exactly on those two boundaries.
const PACKET_CYCLE_MS = 3200;
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

// The persistent connector widget in the [ speak to it ] panel header —
// trolltruths as the hub, one horizontal row, spokes to every source/persona
// feeding it: carlos (the art), umadbro.shop (the merch arm), the NFT
// collection, the troll-crypto coin. Deliberately stays a single row rather
// than the radial hub-and-spoke used for planning — same visual language as
// BootConnector.tsx (components/BootConnector.tsx), but ambient/looping and
// horizontal, not a one-shot reveal.
//
// Each spoke is a real round trip, not one dot bouncing back and forth in
// its own color: a colored packet (the node's own accent) travels node ->
// hub, then a grey packet travels hub -> node, one direction at a time so
// the color itself carries the direction. All four spokes run this in
// lockstep — the face isn't on its own timer, it's a readout of which leg
// is currently running: grin while the colored packets are inbound, sad
// while the grey ones are outbound.
//
// Structure mirrors BootConnector's grid-row technique (node row, stem
// row, one shared wire row, label row) rather than nesting each node with
// its own label, so the wire visibly terminates at every box instead of
// floating below a run of labels.
export default function MiniConnector() {
  const faceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const face = faceRef.current;
    if (!face) return;

    let inbound = true; // matches the colored packets' 0-50% (toward the hub) leg
    const flip = () => {
      inbound = !inbound;
      const nextFace = inbound ? FACE_GRIN : FACE_SAD;
      face.classList.remove("mc-spinning");
      void face.offsetWidth; // restart the animation from scratch
      face.classList.add("mc-spinning");
      setTimeout(() => {
        face.src = nextFace;
      }, SPIN_MS / 2);
    };

    const interval = setInterval(flip, PACKET_CYCLE_MS / 2);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mini-connector">
      <div className="mc-node-slot">
        <div className="mc-node mc-node--carlos">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/boot/carlos-ramirez.webp" alt="Carlos Ramirez" />
        </div>
      </div>
      <div className="mc-node-slot">
        <div className="mc-node mc-node--umadbro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/boot/umadbro.jpg" alt="UMadBro" />
        </div>
      </div>
      <div className="mc-node-slot">
        <div className="mc-hub-ring">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={faceRef} src={FACE_GRIN} alt="TrollTruths" />
        </div>
      </div>
      <div className="mc-node-slot">
        <div className="mc-node mc-node--nft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/boot/troll-nft.jpg" alt="Troll NFT" />
        </div>
      </div>
      <div className="mc-node-slot">
        <div className="mc-node mc-node--crypto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/boot/troll-crypto.jpg" alt="Troll crypto" />
        </div>
      </div>

      <div className="mc-stem" />
      <div className="mc-stem" />
      <div className="mc-stem mc-stem--hub" />
      <div className="mc-stem" />
      <div className="mc-stem" />

      <div className="mc-wire-row">
        <div className="mc-wire-line" />
        <div className="mc-packet mc-packet-out--carlos" />
        <div className="mc-packet mc-packet-in--carlos" />
        <div className="mc-packet mc-packet-out--umadbro" />
        <div className="mc-packet mc-packet-in--umadbro" />
        <div className="mc-packet mc-packet-out--nft" />
        <div className="mc-packet mc-packet-in--nft" />
        <div className="mc-packet mc-packet-out--crypto" />
        <div className="mc-packet mc-packet-in--crypto" />
      </div>

      <div className="mc-label mc-label--carlos">carlos</div>
      <div className="mc-label mc-label--umadbro">umadbro.shop</div>
      <div className="mc-label mc-label--hub">trolltruths</div>
      <div className="mc-label mc-label--nft">NFT</div>
      <div className="mc-label mc-label--crypto">crypto</div>
    </div>
  );
}
