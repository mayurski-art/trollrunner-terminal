// Archive of the day — one numbered TROLL-LORE.md file spotlighted on the
// front page, rotating once a day at 5 PM PST.
//
// The pick is derived from the date rather than stored: a hash of the
// current "archive day" indexes into the section list, so every visitor
// sees the same file on the same day with no DB row, no cron and no write
// path. Change the section count (i.e. add a section to TROLL-LORE.md) and
// the rotation reshuffles, which is fine — it's a spotlight, not a
// schedule anyone is holding us to.

import { allSectionTitles, getArchiveSectionText } from "@/lib/loreSections";
import { findLoreImagesForArchiveSection, type LoreAsset } from "@/lib/loreAssets";
import { sectionDepth, isSeeded } from "@/lib/loreArchive";

// 5 PM PST = 01:00 UTC the following day. Deliberately a fixed UTC offset
// rather than a real America/Los_Angeles conversion: PST is UTC-8
// year-round here, so during PDT (roughly Mar–Nov) the rollover lands at
// 6 PM local. The owner asked for "5 PM PST" specifically, and a fixed
// offset keeps the boundary stable and testable — it never shifts under a
// DST transition, which a tz-aware version would do twice a year.
const ROLLOVER_UTC_HOUR = 1;

// The "archive day" a given instant belongs to, as a YYYY-MM-DD string in
// the rolled-over frame. Anything before 01:00 UTC still belongs to the
// previous day's pick.
export function archiveDayKey(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - ROLLOVER_UTC_HOUR * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

// When the current archive day ends, as an ISO timestamp — the client uses
// this to swap the panel over without a reload, and to scope "dismissed"
// to the current day only.
export function archiveDayEndsAt(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - ROLLOVER_UTC_HOUR * 60 * 60 * 1000);
  const nextMidnightShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1
  );
  return new Date(nextMidnightShifted + ROLLOVER_UTC_HOUR * 60 * 60 * 1000).toISOString();
}

// FNV-1a. Small, dependency-free, and well-mixed enough that consecutive
// day keys ("2026-09-22" / "2026-09-23") land far apart in the section
// list — a plain char-sum would walk the archive in near-order instead.
function hashDayKey(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Days since the rotation epoch, used as an index into a shuffled deck.
// Hashing the day key straight into the section list (the obvious version)
// distributes badly over a year: some sections came up 11 times while
// others came up twice, and a section could repeat twice in one week while
// most of the archive hadn't been shown at all. Dealing from a shuffled
// deck instead guarantees every file is spotlighted once before any
// repeats.
const ROTATION_EPOCH_DAY = Date.UTC(2026, 8, 22) / 86400000;

function dayIndex(dayKey: string): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000 - ROTATION_EPOCH_DAY);
}

// Fisher–Yates, seeded per cycle so each pass through the archive is a
// different order. mulberry32 keeps it deterministic — same cycle, same
// deck, on every server and every request.
function shuffledDeck(size: number, cycle: number): number[] {
  let seed = (hashDayKey(`aotd-cycle-${cycle}`) ^ 0x9e3779b9) >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const deck = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export type ArchiveOfTheDay = {
  number: number;
  title: string;
  depth: 1 | 2;
  // The opening of the section — a teaser, never the whole file. The full
  // body stays behind the archive's PROBLEMS unlock.
  teaser: string;
  // True when the teaser was cut short, i.e. there is more to recover.
  truncated: boolean;
  // Seeded sections are already open for everyone, so the CTA should read
  // as "read it" rather than "recover it".
  seeded: boolean;
  image: { url: string; caption: string } | null;
  dayKey: string;
  endsAt: string;
};

// Roughly two sentences of setup. Long enough to be a real hook, short
// enough that a year of daily picks never adds up to a free archive.
const TEASER_CHARS = 260;

function buildTeaser(body: string): { teaser: string; truncated: boolean } {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= TEASER_CHARS) return { teaser: flat, truncated: false };
  const window = flat.slice(0, TEASER_CHARS);
  // Prefer a sentence boundary, but only if one lands in the back half —
  // otherwise a section opening with an early "Mr." or "$1.2M." would cut
  // the teaser down to a few words.
  const lastStop = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! "));
  if (lastStop > TEASER_CHARS * 0.5) {
    return { teaser: window.slice(0, lastStop + 1), truncated: true };
  }
  const lastSpace = window.lastIndexOf(" ");
  return { teaser: `${window.slice(0, lastSpace > 0 ? lastSpace : TEASER_CHARS)}...`, truncated: true };
}

// Every numbered section is eligible, including the depth-2 files whose
// titles the archive normally redacts to "??" until they're unlocked.
// That's a deliberate call by the owner: the spotlight names them outright.
export function pickArchiveOfTheDay(now: Date = new Date()): ArchiveOfTheDay | null {
  const sections = allSectionTitles();
  if (sections.length === 0) return null;

  const dayKey = archiveDayKey(now);
  // Deal from a deck that reshuffles each time the archive has been fully
  // cycled through. A negative dayIndex (a clock set before the epoch)
  // would otherwise produce a negative modulo, so it's normalised first.
  const idx = dayIndex(dayKey);
  const cycle = Math.floor(idx / sections.length);
  const slot = ((idx % sections.length) + sections.length) % sections.length;
  const picked = sections[shuffledDeck(sections.length, cycle)[slot]];

  const body = getArchiveSectionText(picked.number);
  if (!body) return null;

  const { teaser, truncated } = buildTeaser(body);
  const images: LoreAsset[] = findLoreImagesForArchiveSection(picked.number);
  // One image only — the panel is a slide-in strip, not a gallery. Rotates
  // with the day key so a section with several images doesn't always show
  // the same one.
  const image = images.length > 0 ? images[hashDayKey(`${dayKey}:img`) % images.length] : null;

  return {
    number: picked.number,
    title: picked.title,
    depth: sectionDepth(picked.number),
    teaser,
    truncated,
    seeded: isSeeded(picked.number),
    image: image ? { url: image.url, caption: image.caption } : null,
    dayKey,
    endsAt: archiveDayEndsAt(now),
  };
}
