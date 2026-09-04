"use client";

import { useEffect, useState } from "react";

// The waiting state that replaces a transmission's text while a new one is
// being generated. Modeled on imfebu.com's cryptic footer strip: a fixed-width
// run of geometric glyphs at 10px with wide tracking, regenerated on an
// interval so it reads as live signal rather than a spinner.
const GLYPHS = "▓▒░█⊕⊗◇◉△▽●○⋅·:;~`'";

// Wide enough to fill the panel, short enough that it never wraps at the
// narrowest mobile width — the strip is clipped, not reflowed.
const STRIP_LENGTH = 34;
const TICK_MS = 90;

function randomStrip(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

export default function CrypticWait({ label = "decoding transmission" }: { label?: string }) {
  // Every row starts from the same seed string so the server and the first
  // client paint agree — randomizing during render would hydrate-mismatch.
  const [rows, setRows] = useState<string[]>(() => ["", "", ""]);

  useEffect(() => {
    const id = setInterval(() => {
      setRows([randomStrip(STRIP_LENGTH), randomStrip(STRIP_LENGTH), randomStrip(STRIP_LENGTH)]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="py-2" role="status" aria-live="polite">
      <p className="sr-only">{label}…</p>
      <p
        aria-hidden="true"
        className="text-[10px] tracking-[0.4em] text-center text-problem/70 mb-2 animate-pulse"
      >
        ▓▓ {label} ▓▓
      </p>
      <div aria-hidden="true" className="space-y-1">
        {rows.map((row, i) => (
          <div
            key={i}
            className="text-[10px] tracking-[0.4em] text-terminal overflow-hidden h-3 whitespace-nowrap"
          >
            {row}
          </div>
        ))}
      </div>
      <p
        aria-hidden="true"
        className="mt-2 text-center text-[10px] tracking-[0.4em] text-ghost animate-pulse"
      >
        ░ stand by ░
      </p>
    </div>
  );
}
