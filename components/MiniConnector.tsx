"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const SPIN_MS = 400; // one horizontal turn, grin <-> sad swapped mid-turn while edge-on
// Must match the packet keyframes' full loop length in globals.css
// (.mc-packet-out--* / .mc-packet-in--* animations) — half of it is the
// colored leg (node -> hub), half the grey leg (hub -> node), and the face
// flips exactly on those two boundaries.
const PACKET_CYCLE_MS = 3200;
const FACE_GRIN = "/boot/trollface-grin.svg";
const FACE_SAD = "/boot/trollface-sad.svg";

// Where each node (box and label alike) goes when clicked. Opened in a new
// tab so the terminal session in the panel survives the click.
const LINKS = {
  warfare: "https://trollrunner.net/warfare/",
  carlos: "https://x.com/saint_whynne",
  umadbro: "https://umadbro.shop",
  hub: "https://x.com/trolltruths",
  nft: "https://opensea.io/collection/trollsoneth",
  crypto: "https://www.trollface.io/city",
  pumpfun: "https://pump.fun",
} as const;
type NodeKey = keyof typeof LINKS;

type MiniNode = { key: NodeKey; img: string; alt: string; label: string };

// The main row, left to right, hub in the middle. The grid, the wire's ends
// and every packet's start point derive from this list's length and each
// node's index (--mc-count / --mc-x below).
const NODES: MiniNode[] = [
  { key: "carlos", img: "/boot/carlos-ramirez.webp", alt: "Carlos Ramirez", label: "carlos" },
  { key: "umadbro", img: "/boot/umadbro.jpg", alt: "UMadBro", label: "umadbro.shop" },
  { key: "hub", img: FACE_GRIN, alt: "TrollTruths", label: "trolltruths" },
  { key: "nft", img: "/boot/troll-nft.jpg", alt: "Troll NFT", label: "NFT" },
  { key: "crypto", img: "/boot/troll-crypto.jpg", alt: "Troll crypto", label: "crypto" },
];
// Second tier: each hangs under the main node it grew out of, in that
// node's column. Troll warfare's characters are the NFT bodies; pump.fun is
// where the original $TROLL coin launched.
const CHILDREN: (MiniNode & { parent: NodeKey })[] = [
  { key: "warfare", parent: "nft", img: "/boot/troll-warfare.jpg", alt: "Troll Warfare", label: "troll warfare" },
  { key: "pumpfun", parent: "crypto", img: "/boot/pumpfun.jpg", alt: "Pump.fun", label: "pump.fun" },
];
// Column center (%) for node i under N equal 1fr columns.
const colPct = (i: number) => ((i + 0.5) / NODES.length) * 100;
const parentCol = (parent: NodeKey) => NODES.findIndex((n) => n.key === parent) + 1;

// The persistent connector widget in the [ speak to it ] panel header —
// trolltruths as the hub, one horizontal row, spokes to every source/persona
// feeding it: carlos (the art), umadbro.shop (the merch arm), the NFT
// collection, the troll-crypto coin. Under that row, a second tier hangs
// off the node each one belongs to (CHILDREN): troll warfare under NFT,
// pump.fun under crypto — a tree rather than one ever-longer row, which ran
// out of width at 7 nodes. Same visual language as BootConnector.tsx
// (components/BootConnector.tsx), but ambient/looping, not a one-shot
// reveal.
//
// Each spoke is a real round trip, not one dot bouncing back and forth in
// its own color: a colored packet (the node's own accent) travels node ->
// hub, then a grey packet travels hub -> node, one direction at a time so
// the color itself carries the direction. Every spoke runs this in
// lockstep — the face isn't on its own timer, it's a readout of which leg
// is currently running: grin while the colored packets are inbound, sad
// while the grey ones are outbound. A child's branch runs the same round
// trip vertically, child -> parent then back, on the same clock.
//
// Structure mirrors BootConnector's grid-row technique (node row, stem
// row, one shared wire row, label row) rather than nesting each node with
// its own label, so the wire visibly terminates at every box instead of
// floating below a run of labels.
// variant="header": the homepage's top-of-page placement (where the
// TROLLTRUTHS banner used to be), which gets bigger nodes on desktop.
export default function MiniConnector({ variant }: { variant?: "header" } = {}) {
  const faceRef = useRef<HTMLImageElement>(null);
  // Which node the pointer/focus is on, if any — drives the hint line under
  // the row, which otherwise just says the nodes are clickable at all.
  const [active, setActive] = useState<NodeKey | null>(null);
  const linkProps = (key: NodeKey) => ({
    href: LINKS[key],
    target: "_blank",
    rel: "noopener noreferrer",
    onMouseEnter: () => setActive(key),
    onMouseLeave: () => setActive(null),
    onFocus: () => setActive(key),
    onBlur: () => setActive(null),
  });

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
    <div
      className={`mini-connector${variant === "header" ? " mini-connector--header" : ""}`}
      style={{ "--mc-count": NODES.length } as CSSProperties}
    >
      {NODES.map((n) => (
        <div key={n.key} className="mc-node-slot">
          {n.key === "hub" ? (
            <a className="mc-hub-ring" {...linkProps("hub")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={faceRef} src={n.img} alt={n.alt} />
            </a>
          ) : (
            <a className={`mc-node mc-node--${n.key}`} {...linkProps(n.key)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={n.img} alt={n.alt} />
            </a>
          )}
        </div>
      ))}

      {NODES.map((n) => (
        <div key={n.key} className={`mc-stem${n.key === "hub" ? " mc-stem--hub" : ""}`} />
      ))}

      <div className="mc-wire-row">
        <div className="mc-wire-line" />
        {NODES.flatMap((n, i) =>
          n.key === "hub"
            ? []
            : [
                <div
                  key={`${n.key}-out`}
                  className={`mc-packet mc-packet-out mc-packet-out--${n.key}`}
                  style={{ "--mc-x": `${colPct(i)}%` } as CSSProperties}
                />,
                <div
                  key={`${n.key}-in`}
                  className="mc-packet mc-packet-in"
                  style={{ "--mc-x": `${colPct(i)}%` } as CSSProperties}
                />,
              ],
        )}
      </div>

      {NODES.map((n) => (
        <a key={n.key} className={`mc-label mc-label--${n.key}`} {...linkProps(n.key)} tabIndex={-1}>
          {n.label}
        </a>
      ))}

      {CHILDREN.map((c) => (
        <div key={c.key} className="mc-branch" style={{ gridColumn: parentCol(c.parent) }}>
          <div className="mc-branch-line" />
          <div className={`mc-packet mc-packet-up mc-packet-out--${c.key}`} />
          <div className="mc-packet mc-packet-down" />
        </div>
      ))}
      {CHILDREN.map((c) => (
        <div key={c.key} className="mc-node-slot mc-node-slot--child" style={{ gridColumn: parentCol(c.parent) }}>
          <a className={`mc-node mc-node--${c.key}`} {...linkProps(c.key)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img} alt={c.alt} />
          </a>
        </div>
      ))}
      {CHILDREN.map((c) => (
        <a
          key={c.key}
          className={`mc-label mc-label--child mc-label--${c.key}`}
          style={{ gridColumn: parentCol(c.parent) }}
          {...linkProps(c.key)}
          tabIndex={-1}
        >
          {c.label}
        </a>
      ))}

      <div className="mc-hint" aria-hidden="true">
        {active ? (
          <>&gt; open {LINKS[active].replace(/^https:\/\/(www\.)?/, "")} &#8599;</>
        ) : (
          <>&gt; click a node</>
        )}
        <span className="mc-hint-cursor" />
      </div>
    </div>
  );
}
