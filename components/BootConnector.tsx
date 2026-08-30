"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const RING_DELAY_MS = 550; // gap between one ring appearing and the next
const REVEAL_DURATION_MS = 500; // how long a single node+packet takes to fade/crawl in
const HOLD_AFTER_LAST_MS = 500; // beat after the last ring lands before onConverge fires
const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
const SPIN_INTERVAL_MS = 650; // gap between the start of one spin and the next
const FLASH_MS = 500; // must match .bc-node-flash's animation-duration in globals.css
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

// Every node this reveal knows about, in left-to-right column order, paired
// by `ring` — nodes sharing a ring number appear together, symmetrically
// outward from the hub (ring 0). Adding a node later is just adding an
// entry here (and to MiniConnector's always-on version of this same
// lineage) — the grid, wire, and reveal timing all derive from this array's
// length instead of a hardcoded node count.
type Node = {
  key: string;
  ring: number;
  img: string;
  alt: string;
  label: string;
};

const NODES: Node[] = [
  { key: "carlos", ring: 2, img: "/boot/carlos-ramirez.webp", alt: "", label: "carlos" },
  { key: "umadbro", ring: 1, img: "/boot/umadbro.jpg", alt: "", label: "umadbro.shop" },
  { key: "hub", ring: 0, img: FACE_GRIN, alt: "", label: "trolltruths" },
  { key: "nft", ring: 1, img: "/boot/troll-nft.jpg", alt: "", label: "NFT" },
  { key: "crypto", ring: 2, img: "/boot/troll-crypto.jpg", alt: "", label: "crypto" },
];

const HUB_INDEX = NODES.findIndex((n) => n.ring === 0);
const RING_COUNT = Math.max(...NODES.map((n) => n.ring));
// Column center (%) for node i under `grid-template-columns: repeat(N, 1fr)`.
const colPct = (i: number) => ((i + 0.5) / NODES.length) * 100;
const HUB_PCT = colPct(HUB_INDEX);

// The boot sequence's closing beat: trolltruths (the hub) appears alone
// first, then the rest of the lineage reveals ring by ring, symmetrically
// outward on both sides at once (ring 1: umadbro.shop + NFT, ring 2: carlos
// + crypto, and so on as more nodes join the lineage) — each node fading in
// together with a packet crawling out from the hub to it along the shared
// wire. Once the outermost ring lands, onConverge fires and the overlay
// starts its reveal countdown (BootSequence.tsx) while the hub face keeps
// flipping grin/sad for the remainder of the reveal.
export default function BootConnector({
  onConverge,
}: {
  onConverge: () => void;
}) {
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const packetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const faceRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const nodes = nodeRefs.current;
    const stems = stemRefs.current;
    const labels = labelRefs.current;
    const packets = packetRefs.current;
    const face = faceRef.current;
    if (!face) return;

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

    const timers: ReturnType<typeof setTimeout>[] = [];
    let spinInterval: ReturnType<typeof setInterval> | undefined;

    // Ring 0: just the hub, fades straight in — nothing to crawl toward yet.
    const hubEl = nodes[HUB_INDEX];
    if (hubEl) hubEl.classList.add("bc-revealed");

    // Rings 1..N: every node at that ring fades in while a packet from the
    // hub crawls out to it, both sides at once.
    for (let ring = 1; ring <= RING_COUNT; ring++) {
      const ringIndices = NODES.reduce<number[]>((acc, n, i) => {
        if (n.ring === ring) acc.push(i);
        return acc;
      }, []);
      const t = setTimeout(() => {
        ringIndices.forEach((i) => {
          nodes[i]?.classList.add("bc-revealed");
          stems[i]?.classList.add("bc-revealed");
          labels[i]?.classList.add("bc-revealed");
          const packet = packets[i];
          if (!packet) return;
          packet.style.left = `${HUB_PCT}%`;
          packet.style.opacity = "1";
          const target = colPct(i);
          requestAnimationFrame(() => {
            packet.style.transition = `left ${REVEAL_DURATION_MS}ms ease-out, opacity 150ms ease-in ${REVEAL_DURATION_MS - 150}ms`;
            packet.style.left = `${target}%`;
            packet.style.opacity = "0";
          });

          // Bright one-shot flash on the node right as its packet arrives —
          // this connector never loops like MiniConnector does, so without
          // it the only payoff was the packet dot quietly fading out.
          const hitTimer = setTimeout(() => {
            const node = nodes[i];
            if (!node) return;
            node.classList.add("bc-node--hit");
            setTimeout(() => node.classList.remove("bc-node--hit"), FLASH_MS);
          }, REVEAL_DURATION_MS);
          timers.push(hitTimer);
        });
      }, RING_DELAY_MS * ring);
      timers.push(t);
    }

    const convergeTimer = setTimeout(
      () => {
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
      },
      RING_DELAY_MS * RING_COUNT + REVEAL_DURATION_MS + HOLD_AFTER_LAST_MS,
    );
    timers.push(convergeTimer);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(spinInterval);
    };
  }, [onConverge]);

  return (
    <div
      className="boot-connector"
      style={
        {
          gridTemplateColumns: `repeat(${NODES.length}, 1fr)`,
          "--bc-node-count": NODES.length,
        } as CSSProperties
      }
    >
      {NODES.map((n, i) => (
        <div
          key={n.key}
          ref={(el) => {
            nodeRefs.current[i] = el;
          }}
          className={`bc-node bc-node--${n.key}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={n.key === "hub" ? faceRef : undefined} src={n.img} alt={n.alt} />
        </div>
      ))}

      {NODES.map((n, i) => (
        <div key={n.key} className="bc-stems">
          <div
            ref={(el) => {
              stemRefs.current[i] = el;
            }}
            className={`bc-stem${n.key === "hub" ? " bc-stem--hub" : ""}`}
          />
        </div>
      ))}

      <div className="bc-wire-row">
        <div className="bc-wire-line" />
        {NODES.map((n, i) =>
          n.key === "hub" ? (
            <div key={n.key} className="bc-center" />
          ) : (
            <div
              key={n.key}
              ref={(el) => {
                packetRefs.current[i] = el;
              }}
              className={`bc-packet bc-packet--${n.key}`}
            />
          ),
        )}
      </div>

      {NODES.map((n, i) => (
        <div
          key={n.key}
          ref={(el) => {
            labelRefs.current[i] = el;
          }}
          className={`bc-labels bc-labels--${n.key}`}
        >
          {n.label}
        </div>
      ))}
    </div>
  );
}
