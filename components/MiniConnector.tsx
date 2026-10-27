"use client";

import { useState, type CSSProperties } from "react";

// The hub's mark: the troll runner's looping clip (shared with
// BootConnector.tsx), with its first frame as the poster until it plays.
export const HUB_LOOP = "/boot/troll-runner-loop.mp4";
export const HUB_POSTER = "/boot/troll-runner-loop-poster.jpg";

// Where each node (box and label alike) goes when clicked. Opened in a new
// tab so the terminal session in the panel survives the click.
const LINKS = {
  warfare: "https://trollrunner.net/warfare/",
  carlos: "https://x.com/saint_whynne",
  fukupapers: "https://x.com/fukupapers",
  umadbro: "https://umadbro.shop",
  go2war: "https://x.com/adermaz0ne",
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
  { key: "hub", img: HUB_POSTER, alt: "TrollTruths", label: "trolltruths" },
  { key: "nft", img: "/boot/troll-nft.jpg", alt: "Troll NFT", label: "NFT" },
  { key: "crypto", img: "/boot/troll-crypto.jpg", alt: "Troll crypto", label: "crypto" },
];
// Second tier: each hangs under the main node it grew out of, in that
// node's column, its line labeled with `edge`. seal (@fukupapers, the CEO,
// shown as TROLL #989) under carlos, "IP Rights"; GO2WAR (@adermaz0ne)
// under umadbro.shop, "Designer"; warfare under NFT,
// "Gaming", its characters are the NFT bodies; pump.fun under crypto,
// "Migrated", where the original $TROLL coin launched.
const CHILDREN: (MiniNode & { parent: NodeKey; edge?: string })[] = [
  { key: "fukupapers", parent: "carlos", img: "/boot/troll-989.jpg", alt: "seal (TROLL #989)", label: "seal", edge: "IP Rights" },
  { key: "go2war", parent: "umadbro", img: "/boot/go2war.jpg", alt: "GO2WAR", label: "GO2WAR", edge: "Designer" },
  { key: "warfare", parent: "nft", img: "/boot/troll-warfare.jpg", alt: "Troll Warfare", label: "warfare", edge: "Gaming" },
  { key: "pumpfun", parent: "crypto", img: "/boot/pumpfun.jpg", alt: "Pump.fun", label: "pump.fun", edge: "Migrated" },
];
// Column center (%) for node i under N equal 1fr columns.
const colPct = (i: number) => ((i + 0.5) / NODES.length) * 100;
const parentCol = (parent: NodeKey) => NODES.findIndex((n) => n.key === parent) + 1;
// The square frames' left-to-right lighting order (mc-lit in globals.css):
// column by column, each main node and then whatever hangs under it. The
// hub is a circle with its own ring cycle, so it sits this out.
const LIT_ORDER = NODES.filter((n) => n.key !== "hub").flatMap((n) => [n.key, ...CHILDREN.filter((c) => c.parent === n.key).map((c) => c.key)]);
const litStyle = (key: NodeKey) => ({ "--mc-i": LIT_ORDER.indexOf(key) }) as CSSProperties;
// Edge labels face the hub: right of the line on the hub's left, left of it
// on the hub's right, so the outer columns never run off the screen.
const edgeSide = (parent: NodeKey) => (parentCol(parent) > NODES.findIndex((n) => n.key === "hub") + 1 ? " mc-edge--left" : "");

// The persistent connector widget in the [ speak to it ] panel header —
// trolltruths as the hub, one horizontal row, spokes to every source/persona
// feeding it: carlos (the art), umadbro.shop (the merch arm), the NFT
// collection, the troll-crypto coin. Under that row, a second tier hangs
// off the node each one belongs to (CHILDREN): seal under carlos, GO2WAR under umadbro.shop,
// warfare under NFT, pump.fun under crypto — a tree rather than one
// ever-longer row, which ran out of width at 7 nodes. Same visual language
// as BootConnector.tsx (components/BootConnector.tsx), but ambient/looping,
// not a one-shot reveal. The hub plays the troll runner's loop (HUB_LOOP).
//
// Each spoke is a real round trip, not one dot bouncing back and forth in
// its own color: a colored packet (the node's own accent) travels node ->
// hub, then a grey packet travels hub -> node, one direction at a time so
// the color itself carries the direction. Every spoke runs this in
// lockstep on the CSS packet keyframes' 3.2s clock. A child's branch runs
// the same round trip vertically, child -> parent then back.
//
// Structure mirrors BootConnector's grid-row technique (node row, stem
// row, one shared wire row, label row) rather than nesting each node with
// its own label, so the wire visibly terminates at every box instead of
// floating below a run of labels.
// variant="header": the homepage's top-of-page placement (where the
// TROLLTRUTHS banner used to be), which gets bigger nodes on desktop.
export default function MiniConnector({ variant }: { variant?: "header" } = {}) {
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

  return (
    <div
      className={`mini-connector${variant === "header" ? " mini-connector--header" : ""}`}
      style={{ "--mc-count": NODES.length, "--mc-lit-count": LIT_ORDER.length } as CSSProperties}
    >
      {NODES.map((n) => (
        <div key={n.key} className="mc-node-slot">
          {n.key === "hub" ? (
            <a className="mc-hub-ring" aria-label={n.alt} {...linkProps("hub")}>
              <video src={HUB_LOOP} poster={n.img} autoPlay loop muted playsInline aria-hidden="true" />
            </a>
          ) : (
            <a className={`mc-node mc-node--${n.key}`} style={litStyle(n.key)} {...linkProps(n.key)}>
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
          {c.edge && <em className={`mc-edge${edgeSide(c.parent)}`}>{c.edge}</em>}
          <div className={`mc-packet mc-packet-up mc-packet-out--${c.key}`} />
          <div className="mc-packet mc-packet-down" />
        </div>
      ))}
      {CHILDREN.map((c) => (
        <div key={c.key} className="mc-node-slot mc-node-slot--child" style={{ gridColumn: parentCol(c.parent) }}>
          <a className={`mc-node mc-node--${c.key}`} style={litStyle(c.key)} {...linkProps(c.key)}>
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
