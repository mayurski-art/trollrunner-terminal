"use client";

import { useEffect, useRef } from "react";

const CRAWL_MS = 1100;
const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
const SPIN_INTERVAL_MS = 650; // gap between the start of one spin and the next
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

// Column centers under grid-template-columns: repeat(5, 1fr) — mirrors
// MiniConnector's 10/30/50/70/90% layout so this reads as the same wiring
// diagram, just running once instead of looping.
const NODE_PCT = [10, 30, 70, 90];
const HUB_PCT = 50;

// The boot sequence's closing beat: all four source nodes (carlos,
// umadbro.shop, the NFT collection, the troll-crypto coin — same cast as
// the ambient [ speak to it ] widget, components/MiniConnector.tsx) send
// one packet each into the trolltruths hub at center. The instant they all
// arrive, onConverge fires and the overlay starts its reveal countdown
// (BootSequence.tsx) while the hub face keeps flipping grin/sad for the
// remainder of the reveal.
export default function BootConnector({
  onConverge,
}: {
  onConverge: () => void;
}) {
  const packetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const faceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const packets = packetRefs.current;
    const nodes = nodeRefs.current;
    const face = faceRef.current;
    if (packets.some((p) => !p) || nodes.some((n) => !n) || !face) return;

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

    packets.forEach((packet, i) => {
      if (!packet) return;
      packet.style.left = `${NODE_PCT[i]}%`;
      packet.style.opacity = "1";
    });

    const raf = requestAnimationFrame(() => {
      packets.forEach((packet) => {
        if (!packet) return;
        packet.style.transition = `left ${CRAWL_MS}ms linear`;
        packet.style.left = `${HUB_PCT}%`;
      });
    });

    let spinInterval: ReturnType<typeof setInterval> | undefined;

    const convergeTimer = setTimeout(() => {
      packets.forEach((packet) => {
        if (packet) packet.style.opacity = "0";
      });
      onConverge();

      // the face keeps turning, grin <-> worry, for as long as this stays
      // mounted — not a one-off reaction, a running tell
      let currentFace = FACE_GRIN;
      const spinNext = () => {
        currentFace = currentFace === FACE_GRIN ? FACE_SAD : FACE_GRIN;
        spinTo(currentFace);
      };
      spinNext();
      spinInterval = setInterval(spinNext, SPIN_INTERVAL_MS);
    }, CRAWL_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(convergeTimer);
      clearInterval(spinInterval);
    };
  }, [onConverge]);

  return (
    <div className="boot-connector">
      <div
        ref={(el) => {
          nodeRefs.current[0] = el;
        }}
        className="bc-node bc-node--carlos"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/carlos-ramirez.webp" alt="" />
      </div>
      <div
        ref={(el) => {
          nodeRefs.current[1] = el;
        }}
        className="bc-node bc-node--umadbro"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/umadbro.jpg" alt="" />
      </div>
      <div className="bc-node bc-node--hub">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={faceRef} src={FACE_GRIN} alt="" />
      </div>
      <div
        ref={(el) => {
          nodeRefs.current[2] = el;
        }}
        className="bc-node bc-node--nft"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/troll-nft.jpg" alt="" />
      </div>
      <div
        ref={(el) => {
          nodeRefs.current[3] = el;
        }}
        className="bc-node bc-node--crypto"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/boot/troll-crypto.jpg" alt="" />
      </div>

      <div className="bc-stems">
        <div className="bc-stem" />
      </div>
      <div className="bc-stems">
        <div className="bc-stem" />
      </div>
      <div className="bc-stems">
        <div className="bc-stem bc-stem--hub" />
      </div>
      <div className="bc-stems">
        <div className="bc-stem" />
      </div>
      <div className="bc-stems">
        <div className="bc-stem" />
      </div>

      <div className="bc-wire-row">
        <div className="bc-wire-line" />
        <div
          ref={(el) => {
            packetRefs.current[0] = el;
          }}
          className="bc-packet bc-packet--carlos"
        />
        <div
          ref={(el) => {
            packetRefs.current[1] = el;
          }}
          className="bc-packet bc-packet--umadbro"
        />
        <div
          ref={(el) => {
            packetRefs.current[2] = el;
          }}
          className="bc-packet bc-packet--nft"
        />
        <div
          ref={(el) => {
            packetRefs.current[3] = el;
          }}
          className="bc-packet bc-packet--crypto"
        />
        <div className="bc-center" />
      </div>

      <div className="bc-labels bc-labels--carlos">carlos</div>
      <div className="bc-labels bc-labels--umadbro">umadbro.shop</div>
      <div className="bc-labels bc-labels--hub">trolltruths</div>
      <div className="bc-labels bc-labels--nft">NFT</div>
      <div className="bc-labels bc-labels--crypto">crypto</div>
    </div>
  );
}
