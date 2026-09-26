"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Entry = { q: string; a: string };

// Plain-language explainer for what this site is and does. Content only —
// every fact here should stay in sync with the actual mechanics (see
// lib/persona.ts for transmissions, lib/buddy.ts for the buddy tiers,
// app/api/chat/route.ts for PROBLEMS mining) rather than drifting into its
// own description of how things work.
const ENTRIES: Entry[] = [
  {
    q: "what is this site?",
    a: "trollface terminal — a voice for the trollface itself, broadcasting short dispatches and holding a live chat with anyone who shows up. part of the trollrunner.net network. this is where you can earn the virtual currency called \"PROBLEMS\".",
  },
  {
    q: "what are PROBLEMS?",
    a: "the terminal's own currency. talking to it — real, substantive messages, not filler — slowly mints PROBLEMS. spend them to guess clue transmissions or unlock archive lore early.",
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

// Click-to-open FAQ, placed next to the "part of the trollrunner.net..."
// footer line on every top-level page. Self-contained: no fetch, no
// session — just static copy explaining the site to a first-time visitor.
// Renders as a centered modal overlay (with its own background-scroll
// lock) rather than expanding inline, so opening it doesn't push the rest
// of the page down.
type FaqProps = {
  // "inline" drops the centered/spaced wrapper so the trigger can sit
  // inside another line of text (see Nav's networkBadge).
  trigger?: "block" | "inline";
};

export default function Faq({ trigger = "block" }: FaqProps) {
  const [open, setOpen] = useState(false);

  // No scroll-lock effect needed here: the terminal page (app/page.tsx)
  // already locks html/body scroll unconditionally, so this modal never
  // needs to manage that itself.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-expanded={open}
      className="glow-loop text-sm lg:text-base underline decoration-dim underline-offset-4 [text-shadow:0_1px_3px_var(--background)]"
    >
      [ what is this site? ]
    </button>
  );

  const Wrapper = trigger === "inline" ? "span" : "div";

  // The dialog is fixed-position overlay content — never valid as a
  // descendant of the "inline" trigger's <p> parent (Nav's networkBadge
  // line), so it portals to document.body instead of nesting inline.
  const dialog = open ? (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/90"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="what is this site?"
        className="fixed inset-4 z-50 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl sm:max-h-[80vh] overflow-y-auto border border-dim bg-panel/95 backdrop-blur-sm text-left p-4 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-terminal text-sm tracking-wide">[ what is this site? ]</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="text-ghost hover:text-terminal transition-colors text-xs shrink-0"
          >
            [ close ]
          </button>
        </div>
        {ENTRIES.map((entry) => (
          <div key={entry.q}>
            <p className="text-terminal text-xs sm:text-sm">{entry.q}</p>
            <p className="text-dim text-xs sm:text-sm mt-1 leading-relaxed whitespace-pre-line">{entry.a}</p>
          </div>
        ))}
      </div>
    </>
  ) : null;

  return (
    <Wrapper className={trigger === "inline" ? "relative z-[1] inline" : "relative z-[1] mt-3 text-center"}>
      {button}
      {open && typeof document !== "undefined" ? createPortal(dialog, document.body) : null}
    </Wrapper>
  );
}
