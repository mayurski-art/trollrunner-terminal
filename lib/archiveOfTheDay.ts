// Archive of the day — one numbered TROLL-LORE.md file spotlighted on the
// front page, rotating once a day at 5 PM California time, year-round.
//
// The pick is derived from the date rather than stored: the current
// "archive day" deals a card from a shuffled deck of section numbers, so
// every visitor sees the same file on the same day with no DB row, no
// cron and no write path. Change the section count (i.e. add a section to
// TROLL-LORE.md) and the rotation reshuffles, which is fine — it's a
// spotlight, not a schedule anyone is holding us to.

import { allSectionTitles, getArchiveSectionText } from "@/lib/loreSections";
import { findLoreImagesForArchiveSection, type LoreAsset } from "@/lib/loreAssets";
import { sectionDepth, isSeeded } from "@/lib/loreArchive";

// The file rotates at 5 PM California time, year-round — 17:00 PST in
// winter and 17:00 PDT in summer, so it always lands at 5 PM for a local
// reader. That means the UTC hour of the rollover moves (01:00 UTC under
// PST, 00:00 UTC under PDT), which is why this resolves the real
// America/Los_Angeles offset per instant instead of hardcoding UTC-8.
//
// Intl is the whole implementation on purpose: no tz database to vendor,
// no dependency, and it tracks future DST rule changes with the runtime.
const ZONE = "America/Los_Angeles";
const ROLLOVER_LOCAL_HOUR = 17;

// Los Angeles' UTC offset in minutes at a given instant (e.g. -480 under
// PST, -420 under PDT). Formats the instant in the zone, reads that wall
// time back as if it were UTC, and diffs — the standard trick for getting
// a zone offset out of Intl without a tz library.
function zoneOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Intl renders midnight as hour 24 in some runtimes; normalise to 0 so
  // the arithmetic below doesn't land a day out.
  const hour = get("hour") % 24;
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  // Seconds are floored out of `at` before diffing: formatToParts has
  // whole-second resolution, so leaving millis in would make the offset
  // come out a fraction short and round the wrong way.
  return Math.round((asUTC - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

// The instant 5 PM local occurs on the LA calendar date that `at` falls on.
// Offsets are resolved twice because the offset itself can differ between
// `at` and the target instant (e.g. `at` is PDT but the rollover is PST on
// a transition day); the second pass settles it.
function rolloverInstantFor(at: Date): number {
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
  const [y, m, d] = ymd.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, ROLLOVER_LOCAL_HOUR);
  let guess = wall - zoneOffsetMinutes(at) * 60000;
  guess = wall - zoneOffsetMinutes(new Date(guess)) * 60000;
  return guess;
}

// The LA calendar date `at` falls on, as YYYY-MM-DD.
function zoneDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

// The LA date immediately before `sameDate`, found by stepping back from
// `from` until the local date actually differs. A fixed subtraction can't
// do this reliably: the fall-back day is 25 hours long locally, so -18h
// and even -24h from some instants still land on the same date.
function previousZoneDate(from: Date, sameDate: string): string {
  for (const hours of [20, 24, 26, 30]) {
    const candidate = zoneDate(new Date(from.getTime() - hours * 3600000));
    if (candidate !== sameDate) return candidate;
  }
  // Unreachable for real timezones (no zone shifts a full day), but a
  // defined fallback beats returning the same key and stalling the
  // rotation.
  return zoneDate(new Date(from.getTime() - 48 * 3600000));
}

// The first 5 PM rollover strictly after `at`.
//
// Deliberately a scan of the next few local days rather than "+24h then
// re-resolve": from 11 PM on the eve of a DST change, +24h lands two
// local dates ahead and silently skips a day's rollover entirely (found
// by the sweep below — it produced a 41-hour gap).
function nextRolloverAfter(at: Date): number {
  // Today's 5 PM, if it hasn't happened yet.
  const todays = rolloverInstantFor(at);
  if (todays > at.getTime()) return todays;
  // Otherwise the next one is on the following LOCAL date. That date is
  // computed on the calendar and converted back, rather than reached by
  // adding hours to an instant: hour arithmetic either overshoots (+24h
  // from 11 PM on a spring-forward eve skips a whole day) or undershoots
  // (the fall-back day is 25 hours long), and both were live bugs here.
  const [y, m, d] = zoneDate(at).split("-").map(Number);
  // Date.UTC normalises a month/day overflow (Dec 32 -> Jan 1), so
  // month ends and year ends need no special casing.
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 12));
  return rolloverInstantFor(tomorrow);
}

// The "archive day" a given instant belongs to: the LA date of the 5 PM
// rollover that has most recently passed.
//
// Note this is NOT simply the local calendar date — that would change the
// file at midnight. From 5 PM Thursday through 4:59 PM Friday the key is
// Thursday's, so the pick turns over at 5 PM exactly once per day, which
// is the whole point of the feature.
export function archiveDayKey(now: Date = new Date()): string {
  const todaysRollover = rolloverInstantFor(now);
  // Already past today's 5 PM -> today's date owns the current file.
  if (now.getTime() >= todaysRollover) return zoneDate(now);
  // Otherwise the file still belongs to yesterday's 5 PM. The previous LA
  // date is found by stepping back and re-checking rather than by a fixed
  // offset: on the fall-back day the local day is 25 hours long, so a
  // flat -18h (or even -24h from some instants) still lands on today.
  return previousZoneDate(new Date(todaysRollover), zoneDate(now));
}

// When the current archive day ends, as an ISO timestamp — the client uses
// this to swap the panel over without a reload, and to scope "dismissed"
// to the current day only.
export function archiveDayEndsAt(now: Date = new Date()): string {
  return new Date(nextRolloverAfter(now)).toISOString();
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
