"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { HUB_LOOP, HUB_POSTER } from "./MiniConnector";

const RING_DELAY_MS = 550; // gap between one ring appearing and the next
const REVEAL_DURATION_MS = 500; // how long a single node+packet takes to fade/crawl in
const HOLD_AFTER_LAST_MS = 500; // beat after the last ring lands before onConverge fires
const FLASH_MS = 500; // must match .bc-node-flash's animation-duration in globals.css

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
  { key: "hub", ring: 0, img: HUB_POSTER, alt: "", label: "trolltruths" },
  { key: "nft", ring: 1, img: "/boot/troll-nft.jpg", alt: "", label: "NFT" },
  { key: "crypto", ring: 2, img: "/boot/troll-crypto.jpg", alt: "", label: "crypto" },
];

// Second tier, same as MiniConnector's CHILDREN: each hangs under its
// parent's column and drops in on one more ring after the main row lands.
const CHILDREN: (Omit<Node, "ring"> & { parent: string; edge?: string })[] = [
  { key: "fukupapers", parent: "carlos", img: "/boot/troll-989.jpg", alt: "", label: "seal", edge: "IP Rights" },
  { key: "go2war", parent: "umadbro", img: "/boot/go2war.jpg", alt: "", label: "GO2WAR", edge: "Designer" },
  { key: "warfare", parent: "nft", img: "/boot/troll-warfare.jpg", alt: "", label: "warfare", edge: "Gaming" },
  { key: "pumpfun", parent: "crypto", img: "/boot/pumpfun.jpg", alt: "", label: "pump.fun", edge: "Migrated" },
];
const parentCol = (parent: string) => NODES.findIndex((n) => n.key === parent) + 1;

const HUB_INDEX = NODES.findIndex((n) => n.ring === 0);
const RING_COUNT = Math.max(...NODES.map((n) => n.ring));
const CHILD_RING = RING_COUNT + 1;
const LAST_RING = CHILDREN.length ? CHILD_RING : RING_COUNT;
// Column center (%) for node i under `grid-template-columns: repeat(N, 1fr)`.
const colPct = (i: number) => ((i + 0.5) / NODES.length) * 100;
const HUB_PCT = colPct(HUB_INDEX);

// The boot sequence's closing beat: trolltruths (the hub) appears alone
// first, then the rest of the lineage reveals ring by ring, symmetrically
// outward on both sides at once (ring 1: umadbro.shop + NFT, ring 2: carlos
// + crypto; then the second tier, seal under carlos, GO2WAR under umadbro.shop, warfare under NFT
// and pump.fun under crypto, drops in down its branch) — each main-row
// node fading in together with a packet crawling out from the hub to it along the shared
// wire. Once the outermost ring lands, onConverge fires and the overlay
// starts its reveal countdown (BootSequence.tsx). The hub plays the troll
// runner loop (HUB_LOOP, shared with MiniConnector) the whole time.
// `active` exists so BootSequence can mount this from the very first frame
// (it must, or adding it to the centered column mid-sequence shoves the boot
// text upward — see the note there) while the reveal itself still waits for
// the connector phase. Without the gate, mounting early would start these
// timers during the typing phase and fire onConverge before the boot text
// had finished printing.
export default function BootConnector({
  onConverge,
  active = true,
}: {
  onConverge: () => void;
  active?: boolean;
}) {
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const stemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const packetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const childRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!active) return;
    const nodes = nodeRefs.current;
    const stems = stemRefs.current;
    const labels = labelRefs.current;
    const packets = packetRefs.current;

    const timers: ReturnType<typeof setTimeout>[] = [];

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

    // The second tier: each child's branch, box and label (grouped under one
    // .bc-child wrapper per child) fade in together, then flash on landing.
    if (CHILDREN.length) {
      const children = childRefs.current;
      const t = setTimeout(() => {
        children.forEach((el) => {
          if (!el) return;
          el.classList.add("bc-revealed");
          const hitTimer = setTimeout(() => {
            el.classList.add("bc-node--hit");
            setTimeout(() => el.classList.remove("bc-node--hit"), FLASH_MS);
          }, REVEAL_DURATION_MS);
          timers.push(hitTimer);
        });
      }, RING_DELAY_MS * CHILD_RING);
      timers.push(t);
    }

    const convergeTimer = setTimeout(
      onConverge,
      RING_DELAY_MS * LAST_RING + REVEAL_DURATION_MS + HOLD_AFTER_LAST_MS,
    );
    timers.push(convergeTimer);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [onConverge, active]);

  return (
    <div
      className="boot-connector"
      style={
        {
          gridTemplateColumns: `repeat(${NODES.length}, minmax(0, 1fr))`,
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
          {n.key === "hub" ? (
            <video src={HUB_LOOP} poster={n.img} autoPlay loop muted playsInline aria-hidden="true" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={n.img} alt={n.alt} />
          )}
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

      {CHILDREN.map((c, i) => (
        <div
          key={c.key}
          ref={(el) => {
            childRefs.current[i] = el;
          }}
          className={`bc-child bc-child--${c.key}`}
          style={{ gridColumn: parentCol(c.parent) }}
        >
          <div className="bc-branch">{c.edge && <em className={`bc-edge${parentCol(c.parent) > HUB_INDEX + 1 ? " bc-edge--left" : ""}`}>{c.edge}</em>}</div>
          <div className={`bc-node bc-node--${c.key}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img} alt={c.alt} />
          </div>
          <div className={`bc-labels bc-labels--${c.key}`}>{c.label}</div>
        </div>
      ))}
    </div>
  );
}
