"use client";

import { useState } from "react";

type Entry = { q: string; a: string };

// Plain-language explainer for what this site is and does. Content only —
// every fact here should stay in sync with the actual mechanics (see
// lib/persona.ts for transmissions, lib/buddy.ts for the buddy tiers,
// app/api/chat/route.ts for PROBLEMS mining) rather than drifting into its
// own description of how things work.
const ENTRIES: Entry[] = [
  {
    q: "what is this site?",
    a: "trollface terminal — a voice for the trollface itself, broadcasting short dispatches and holding a live chat with anyone who shows up. part of the trollrunner.net network.",
  },
  {
    q: "what are transmissions?",
    a: "short posts the terminal broadcasts on its own, unprompted — a mix of in-character musing and fragments of a larger story it's slowly piecing together. new ones show up on the home page and get archived in the logs.",
  },
  {
    q: "what are the different kinds of transmissions?",
    a: '"clue" transmissions (marked ▚▞) drop one piece of something bigger — the ledger, the drawing, the shop, another presence — meant to be pieced together over time, not explained outright. "musing" transmissions (marked ▓▒▓) are just what\'s on its mind, no puzzle attached. plenty carry no mark at all.',
  },
  {
    q: "why look at the logs?",
    a: "the logs are the full transmission archive, filterable by clue / musing / unmarked. clue transmissions there are guessable — spend a PROBLEM to take a shot at what it's actually circling, and a correct guess pays back more than it cost.",
  },
  {
    q: "why read through the archive?",
    a: "the archive holds the terminal's background lore — pieces of its history you can unlock by talking to it (each qualifying message chips away at one) or pay to open early with PROBLEMS. treat it like a library: not required, but the deeper lore for anyone actually digging.",
  },
  {
    q: "what's the buddy system?",
    a: "a friendship meter that grows purely from how much you talk to the terminal. six tiers, stranger up through ride or die, each one giving you a slightly better shot at a random bonus PROBLEM on any given message. flavor on top of the real economy, never guaranteed.",
  },
  {
    q: "what are PROBLEMS?",
    a: "the terminal's own currency. talking to it — real, substantive messages, not filler — slowly mints PROBLEMS. spend them to guess clue transmissions, unlock archive lore early, or reach the undervoice.",
  },
  {
    q: "what's the undervoice?",
    a: "something the terminal only half-admits to. it's a second, stranger presence, reachable only by spending PROBLEMS you've already earned talking to the main terminal.",
  },
  {
    q: "what's the vault?",
    a: "where your PROBLEMS balance lives. redemption for real value isn't live yet — for now it's a ledger of what you've earned.",
  },
];

// Click-to-expand FAQ, placed next to the "part of the trollrunner.net..."
// footer line on every top-level page. Self-contained: no fetch, no
// session — just static copy explaining the site to a first-time visitor.
export default function Faq() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-[1] mt-3 text-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-foreground text-xs underline decoration-dim underline-offset-4 hover:text-terminal [text-shadow:0_1px_3px_var(--background)]"
      >
        [ {open ? "close faq" : "what is this site?"} ]
      </button>
      {open && (
        <div className="mt-4 mx-auto max-w-2xl text-left border border-dim bg-panel/60 p-4 sm:p-5 space-y-4">
          {ENTRIES.map((entry) => (
            <div key={entry.q}>
              <p className="text-terminal text-xs sm:text-sm">{entry.q}</p>
              <p className="text-dim text-xs sm:text-sm mt-1 leading-relaxed">{entry.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
