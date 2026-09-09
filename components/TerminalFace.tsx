"use client";

// "Who you're talking to" glyph + label above the chat. Modeled on
// imfebu.com/rent's sidebar roster (captured via screen recording +
// frame-by-frame DOM extraction, 2026-09-08): on the source site all 7
// entities sit on screen at once, each with its own two ASCII eyes/features
// blinking independently and asynchronously forever — never a synchronized
// blink, never one face turning into another. Our single glyph slot can't
// show all 7 at once, so this keeps the closest match: it rotates which
// entity is shown (a card flip, unrelated to blinking), and whichever one
// is showing runs its own real per-feature blink loop the whole time it's
// up, using that entity's actual captured symbol pairs rather than a
// generic placeholder.
//
// The label text renders here too (not in a parent reading a callback) so
// the glyph and its adjacent phrase always share one entity value on one
// render — coloring them from two different components' state risked a
// visible one-tick lag between the glyph's color changing and the label
// catching up.
import { useEffect, useRef, useState } from "react";

const FACE_HOLD_MS = 4000; // how long each entity stays on screen before flipping to the next
const FLIP_MS = 400; // full flip duration; must match .terminal-face-flip's animation-duration in globals.css

// Each entity is a template with 1-2 blink slots plus the short (1-4 word)
// trolltruths-flavored phrase shown next to it. Every slot cycles through
// its own `states` list on an independent randomized timer (scheduleBlink
// below) — exactly the async, never-synced rhythm captured on the source
// page, just generalized from ven's original single eye-pair to however
// many blinking parts each entity actually has.
const ENTITIES = [
  {
    name: "kiri",
    label: "trollface terminal",
    color: "rgb(187, 103, 228)",
    prefix: "(",
    suffix: ")",
    slots: [
      { states: ["●", "-"] as const, between: "_" },
      { states: ["●", "-"] as const, between: "" },
    ],
  },
  {
    name: "mav",
    label: "trolltruths terminal",
    color: "rgb(60, 221, 167)",
    prefix: "[",
    suffix: "]",
    slots: [
      { states: ["°", "•"] as const, between: "_" },
      { states: ["•", "°"] as const, between: "" },
    ],
  },
  {
    name: "rylo",
    label: "the truth engine",
    color: "rgb(235, 153, 71)",
    prefix: "<",
    suffix: ">",
    slots: [
      { states: ["◡", "⌢"] as const, between: "_" },
      { states: ["◠", "⌣"] as const, between: "" },
    ],
  },
  {
    name: "ven",
    label: "infinite troll lore",
    color: "rgb(82, 153, 224)",
    prefix: "(⌐",
    suffix: ")",
    slots: [
      { states: ["■", "□"] as const, between: "_" },
      { states: ["□", "■"] as const, between: "" },
    ],
  },
  {
    name: "tyra",
    label: "listening to the grin",
    color: "rgb(224, 82, 129)",
    prefix: "{",
    suffix: "}",
    slots: [
      { states: ["⊙", "⊘"] as const, between: "_" },
      { states: ["⊘", "⊙"] as const, between: "" },
    ],
  },
  {
    name: "zeri",
    label: "decoding the bit",
    color: "rgb(71, 209, 71)",
    prefix: "/ᐠ",
    suffix: "ᐟ\\",
    slots: [{ states: [".-.", "..."] as const, between: "" }],
  },
  {
    name: "lumo",
    label: "terminal of trolls",
    color: "rgb(244, 209, 37)",
    prefix: "☼(°",
    suffix: "°)☼",
    slots: [{ states: ["▽", "△", "∪"] as const, between: "" }],
  },
] as const;

// Each blink slot flips to a random next state (never repeating the current
// one) after 1-1.5s, independently of every other slot — the same cadence
// and never-synced-with-its-neighbor rhythm as the source recording.
function scheduleBlink(stateCount: number, setState: (updater: (v: number) => number) => void): () => void {
  let timeout: ReturnType<typeof setTimeout>;
  const tick = () => {
    setState((v) => {
      if (stateCount <= 1) return v;
      let next = Math.floor(Math.random() * stateCount);
      if (next === v) next = (next + 1) % stateCount;
      return next;
    });
    timeout = setTimeout(tick, 1000 + Math.random() * 500);
  };
  timeout = setTimeout(tick, 1000 + Math.random() * 500);
  return () => clearTimeout(timeout);
}

function EntityFace({ entity }: { entity: (typeof ENTITIES)[number] }) {
  const [slotIndices, setSlotIndices] = useState<number[]>(() => entity.slots.map(() => 0));

  useEffect(() => {
    const stops = entity.slots.map((slot, i) => {
      // Offset each slot's start so multiple blinking parts on the same
      // entity never begin in lockstep, matching the asynchronous rhythm
      // captured on the source page.
      let stop: (() => void) | null = null;
      const start = setTimeout(() => {
        stop = scheduleBlink(slot.states.length, (updater) =>
          setSlotIndices((prev) => {
            const next = [...prev];
            next[i] = updater(prev[i]);
            return next;
          })
        );
      }, i * 500);
      return () => {
        clearTimeout(start);
        stop?.();
      };
    });
    return () => stops.forEach((stop) => stop());
  }, [entity]);

  const glyph =
    entity.prefix +
    entity.slots.map((slot, i) => slot.states[slotIndices[i]] + slot.between).join("") +
    entity.suffix;

  return <>{glyph}</>;
}

export default function TerminalFace() {
  const [index, setIndex] = useState(0);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Same swap-at-the-midpoint trick as MiniConnector's hub face: start
      // the flip animation, then change which entity is showing at exactly
      // FLIP_MS / 2 (the point where the card is edge-on and invisible),
      // so the switch itself is never visible — only the flip is.
      const span = spanRef.current;
      span?.classList.remove("terminal-face-flip");
      void span?.offsetWidth; // restart the animation from scratch
      span?.classList.add("terminal-face-flip");
      setTimeout(() => {
        setIndex((i) => (i + 1) % ENTITIES.length);
      }, FLIP_MS / 2);
    }, FACE_HOLD_MS);
    return () => clearInterval(interval);
  }, []);

  const current = ENTITIES[index];

  return (
    <span className="inline-flex items-center gap-1.5 sm:gap-2">
      <span className="terminal-face-stage inline-block" aria-hidden="true">
        <span
          ref={spanRef}
          className="font-mono select-none inline-block"
          style={{
            color: current.color,
            textShadow: `0 0 6px color-mix(in srgb, ${current.color} 55%, transparent)`,
          }}
          title={`trollface terminal — ${current.name}`}
        >
          <EntityFace entity={current} />
        </span>
      </span>
      <span className="whitespace-nowrap" style={{ color: current.color }}>
        {current.label}
      </span>
    </span>
  );
}
