"use client";

import { useEffect, useRef, useState } from "react";

type Entry = { q: string; a: string };

// Plain-language explainer, shown under the how-it-works graphic. Every fact
// here should stay in sync with the actual mechanics (see lib/persona.ts for
// transmissions, lib/buddy.ts for the buddy tiers, app/api/chat/route.ts for
// PROBLEMS mining) — and with public/assets/instructions.jpg, which draws the
// same numbers.
const ENTRIES: Entry[] = [
  {
    q: "what is this site?",
    a: "trollface terminal — a voice for the trollface itself, broadcasting short dispatches and holding a live chat with anyone who shows up. part of the trollrunner.net network. this is where you can earn the virtual currency called \"PROBLEMS\".",
  },
  {
    q: "what are PROBLEMS?",
    a: "the terminal's own currency. talking to it — real, substantive messages, not filler — mints 1 PROBLEM per message. spend them to guess clue transmissions or unlock archive lore early.",
  },
  {
    q: "what are transmissions?",
    a: "short posts the terminal broadcasts on its own, unprompted — a mix of trolling and fragments of a larger story, whether that is news from the official troll X account, or any major troll news. new ones show up on the home page and get archived in the logs.\n\nusers can earn +10 \"PROBLEMS\" by solving each transmission in [logs], correctly. however it costs a \"PROBLEM\" to attempt this.",
  },
  {
    q: "why look at the logs?",
    a: "the logs are the full transmission archive. it's fun to read and guess. problem?",
  },
  {
    q: "what's the vault?",
    a: "where your PROBLEMS balance can be seen, and where you can redeem it — for XP (1 PROBLEM = 25 XP). also 69 \"PROBLEMS\" can be redeemed for 1 $TROLL coin airdrop. make sure the wallet is correct. your \"PROBLEMS\" balance can be seen all throughout the website — on the top right corner as well.",
  },
  {
    q: "why read through the archive?",
    a: "the archive holds the terminal's background lore — pieces of troll history you can unlock. pay one \"PROBLEM\" to unlock an article in the [archive]. treat it like a library: not required, but the deeper you explore into the troll lore, the more of a troll you become.",
  },
  {
    q: "what's the buddy system?",
    a: "a friendship meter that grows purely from how much you talk to the terminal. six tiers, stranger up through ride or die, each one giving you a slightly better shot at a random bonus PROBLEM on any given message.",
  },
];

// A vertical "instructions" tab that peeks in from the right edge of every
// page. Hovering it (or focusing it with the keyboard) slides the drawer
// out; moving the pointer off the drawer slides it back. Touch screens have
// no hover, so a tap toggles it instead and a tap anywhere else closes it.
// Tailwind's hover: variants only apply under @media (hover: hover), so a
// tap never leaves the drawer stuck open on a phone.
//
// The tab sits in the upper part of the screen rather than centered, so it
// never lands under the archive-of-the-day card, which is centered on the
// right edge on desktop.
export default function InstructionsTab() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-open={open || undefined}
      className="instructions-drawer group fixed right-0 top-[4dvh] z-40 flex items-start pointer-events-none"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="instructions-panel"
        className="pointer-events-auto mt-[14dvh] shrink-0 border border-r-0 border-terminal bg-panel/95 backdrop-blur-sm px-1.5 py-3 text-terminal text-xs lg:text-sm tracking-[0.3em] uppercase [writing-mode:vertical-rl] rotate-180 shadow-[0_0_16px_rgba(51,255,102,0.25)] transition-colors hover:bg-terminal hover:text-background group-data-[open]:bg-terminal group-data-[open]:text-background"
      >
        instructions
      </button>
      <div
        id="instructions-panel"
        role="region"
        aria-label="instructions"
        className="pointer-events-auto w-[var(--instructions-w)] max-h-[92dvh] overflow-y-auto overscroll-contain border border-r-0 border-terminal bg-panel/95 backdrop-blur-sm"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/instructions.jpg"
          alt="how the terminal works: talk to it to mint PROBLEMS, then spend them in the logs, archive and vault"
          width={1152}
          height={1728}
          decoding="async"
          className="block w-full h-auto"
        />
        <div className="p-4 space-y-4 text-left">
          {ENTRIES.map((entry) => (
            <div key={entry.q}>
              <p className="text-terminal text-xs sm:text-sm">{entry.q}</p>
              <p className="text-dim text-xs sm:text-sm mt-1 leading-relaxed whitespace-pre-line">
                {entry.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
