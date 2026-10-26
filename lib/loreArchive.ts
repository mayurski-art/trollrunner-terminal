// The lore archive — docs/TERMINAL-V4-DESIGN.md §3. Every numbered section
// of docs/TROLL-LORE.md is a "file" in the terminal's memory: recovered by
// talking about its topic (see lib/loreSections.ts's pickTopSection, wired
// into app/api/chat/route.ts) or by spending PROBLEMS to force it open
// (app/api/archive/route.ts). This file holds the static per-section
// config that isn't derivable from the lore text itself.

import { sectionsPostedSince } from "@/lib/loreSections";

// Seeded open for every user with no unlock row needed — establishes the
// voice and the world before anyone's talked to it at all. Picked per
// docs/TERMINAL-V4-DESIGN.md §3.4: §1 (core identity, always in every
// prompt anyway), §2 (the IP deal), §3 ($TROLL basics), §6 (Guardian/FUD
// ledger), §8 (trollrunner.net <-> trollface.io), §12 (the 3,333). Kept
// disjoint from DEPTH_2_SECTIONS below on purpose — a redacted-title deep
// file that's also seeded open would show its real title to everyone from
// the start, defeating the point of marking it deep at all.
export const SEEDED_OPEN_SECTIONS = new Set([1, 2, 3, 6, 8, 12]);

// depth: 2 — redacted title (`??`) until unlocked. Costs the same flat
// PROBLEM price as every other file. Per docs/TERMINAL-V4-DESIGN.md §11: the sections that are the
// most load-bearing lore, kept as the archive's rarest finds. §33 (the
// section about the site's owner personally) is deliberately in this set
// AND public — the deepest file being the one that rewards going all the
// way in, not sealed-forever or owner-only.
export const DEPTH_2_SECTIONS = new Set([13, 25, 26, 33, 42]);

export function sectionDepth(sectionNumber: number): 1 | 2 {
  return DEPTH_2_SECTIONS.has(sectionNumber) ? 2 : 1;
}

export function isSeeded(sectionNumber: number): boolean {
  return SEEDED_OPEN_SECTIONS.has(sectionNumber);
}

// A freshly posted file is open to everyone for its first day — the same
// window the front page's NEW FILE box uses (app/api/newest-file/route.ts).
// Timed off the `<!-- posted: ... -->` line under its heading; a file with
// no posted line never gets the window. Once it closes the file seals again
// for anyone who hasn't recovered it (via chat or PROBLEMS).
export const FREE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isFreshlyPosted(sectionNumber: number): boolean {
  return sectionsPostedSince(Date.now() - FREE_WINDOW_MS).includes(sectionNumber);
}

// Readable without an unlock row: seeded open, or inside its free window.
export function isOpenToAll(sectionNumber: number): boolean {
  return isSeeded(sectionNumber) || isFreshlyPosted(sectionNumber);
}
