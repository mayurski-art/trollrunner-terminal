import fs from "node:fs";
import path from "node:path";

// docs/TROLL-LORE.md grew to ~57KB (~14.5k tokens) and was being sent in
// full as its own system block on every single generation call (chat,
// undervoice, broadcast post) — by far the largest line in API spend. This
// splits it into its numbered `## ` sections and picks a small, relevant
// subset per call instead, the same cheap keyword-match style already used
// by lib/loreAssets.ts for lore images (no embeddings, no extra dependency).

const RAW = fs.readFileSync(path.join(process.cwd(), "docs/TROLL-LORE.md"), "utf-8");

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "at", "for", "with", "about", "that", "this", "it",
  "its", "he", "she", "they", "we", "you", "your", "his", "her", "their", "not",
  "just", "so", "do", "did", "have", "has", "had", "what", "how", "why", "like",
  "know", "than", "into", "from", "as", "by", "who", "which", "one", "all",
  "before", "after", "over", "still", "already", "actually", "really", "already",
]);

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9$']+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}

type LoreSection = {
  number: number | null; // leading "N." in the title, or null (e.g. the closing section)
  title: string;
  body: string;
  keywords: Set<string>;
};

function parseSections(): LoreSection[] {
  const parts = RAW.split(/\n(?=## )/);
  const sections: LoreSection[] = [];
  for (const part of parts) {
    if (!part.startsWith("## ")) continue;
    const newlineAt = part.indexOf("\n");
    const title = part.slice(3, newlineAt === -1 ? undefined : newlineAt).trim();
    const body = part.trim();
    const numberMatch = title.match(/^(\d+)\./);
    const number = numberMatch ? Number(numberMatch[1]) : null;

    // Pull keywords from the heading plus any **bolded** terms in the body
    // (named people/things — headings are often oblique, e.g. "The coffee
    // break that found the butterfly" never says "chaos theory").
    const bolded = [...body.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]);
    const keywords = new Set([
      ...significantWords(title),
      ...bolded.flatMap((b) => significantWords(b)),
    ]);

    sections.push({ number, title, body, keywords });
  }
  return sections;
}

const SECTIONS = parseSections();
const CORE_IDENTITY = SECTIONS.find((s) => s.number === 1)!;
const USAGE_GUIDANCE = SECTIONS.find((s) => s.title === "How the persona should use this")!;
const selectable = SECTIONS.filter((s) => s !== CORE_IDENTITY && s !== USAGE_GUIDANCE);

// The closing guidance section is itself ~3.5k tokens — most of its bullets
// are per-section callouts ("§13 is the single best piece of material for
// the persona's voice..."), useless dead weight on a call where that
// section wasn't selected. Split it into bullets and only keep ones that
// either apply generally (no §-reference) or reference a section that's
// actually in play this round.
const USAGE_HEADING = USAGE_GUIDANCE.body.slice(0, USAGE_GUIDANCE.body.indexOf("\n"));
const USAGE_BULLETS = USAGE_GUIDANCE.body
  .slice(USAGE_GUIDANCE.body.indexOf("\n") + 1)
  .split(/\n(?=- )/)
  .map((b) => b.trim())
  .filter(Boolean)
  .map((text) => {
    const refs = new Set<number>();
    for (const m of text.matchAll(/§§?(\d+)(?:[–-](\d+))?/g)) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : start;
      for (let n = start; n <= end; n++) refs.add(n);
    }
    return { text, refs };
  });

// Even after per-section filtering this block dominates the prompt — the
// unreferenced "applies generally" bullets alone run to thousands of chars.
// Cap it so guidance can't crowd out the lore it's meant to annotate.
const MAX_USAGE_CHARS = 6000;

function buildUsageGuidance(selectedNumbers: Set<number>): string {
  // Section-specific bullets come first: they're the ones earned by this
  // call's actual selection, so they survive the cap ahead of generic advice.
  const relevant = USAGE_BULLETS.filter((b) => b.refs.size > 0 && [...b.refs].some((n) => selectedNumbers.has(n)));
  const general = USAGE_BULLETS.filter((b) => b.refs.size === 0);

  const bullets: string[] = [];
  let budget = MAX_USAGE_CHARS;
  for (const b of [...relevant, ...general]) {
    if (b.text.length > budget) continue;
    bullets.push(b.text);
    budget -= b.text.length;
  }
  return USAGE_HEADING + "\n" + bullets.join("\n");
}

const INTRO =
  "Background knowledge you can draw on obliquely, in your own voice, per the " +
  "'How the persona should use this' section below — never recite this as a " +
  "script, a press release, or a list of facts. This is a partial excerpt, not " +
  "the complete archive — if nothing here fits what's being said, that's fine, " +
  "fall back to your established voice and identity instead of straining to " +
  "connect an unrelated section.\n\n";

function scoreSections(recentText: string) {
  const queryWords = new Set(significantWords(recentText));
  return selectable
    .map((s) => ({
      section: s,
      score: [...s.keywords].filter((k) => queryWords.has(k)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Sections vary from a few hundred chars to several thousand, so a count
// cap alone let long ones stack up — combined with the usage-guidance block
// that pushed the prompt past Groq's request-size limit, which made it 413
// on every transmission and silently burn its slot in the free-provider
// rotation. Budget on characters as well as count, highest-scoring first.
const MAX_LORE_CHARS = 10000;

export function selectLoreSections(recentText: string, maxSections = 4): string {
  const ranked = scoreSections(recentText).slice(0, maxSections);

  const scored: LoreSection[] = [];
  let budget = MAX_LORE_CHARS - CORE_IDENTITY.body.length;
  for (const { section } of ranked) {
    if (section.body.length > budget) continue;
    scored.push(section);
    budget -= section.body.length;
  }

  const selectedNumbers = new Set<number>([1, ...scored.map((s) => s.number).filter((n): n is number => n !== null)]);

  const chosen = [CORE_IDENTITY, ...scored];
  return (
    INTRO +
    chosen.map((s) => s.body).join("\n\n") +
    "\n\n" +
    buildUsageGuidance(selectedNumbers)
  );
}

// Powers the archive's Path A (docs/TERMINAL-V4-DESIGN.md §3.2): the
// single top-scoring section for this call, if any topped zero — the same
// scoring selectLoreSections already runs, just returning an id instead of
// a text block. Deliberately independent of maxSections/the 4-section cap
// used for prompt context — the archive only ever unlocks one file per
// qualifying reply regardless of how many sections got fed to the model.
export function pickTopSection(recentText: string): number | null {
  const top = scoreSections(recentText)[0];
  return top?.section.number ?? null;
}

// The full manifest for /archive — every real, numbered section's title.
// Excludes CORE_IDENTITY (section 1 is always seeded open, see
// lib/loreArchive.ts) only in the sense that callers may special-case it;
// it's included here since it's still a real, numbered section.
export function allSectionTitles(): { number: number; title: string }[] {
  return selectable
    .map((s) => ({ number: s.number, title: s.title }))
    .filter((s): s is { number: number; title: string } => s.number !== null)
    .concat([{ number: CORE_IDENTITY.number as number, title: CORE_IDENTITY.title }])
    .sort((a, b) => a.number - b.number);
}

// Plain text for the archive page — TROLL-LORE.md is authored as Markdown
// (## headings, **bold**) for a human reader of the source file, but every
// text surface in this app renders raw content with whitespace-pre-wrap,
// no Markdown parser. Strips the heading (the archive UI shows its own
// title separately) and unwraps **bold** so asterisks don't leak through.
export function getArchiveSectionText(sectionNumber: number): string | null {
  const match = SECTIONS.find((s) => s.number === sectionNumber);
  if (!match) return null;
  const withoutHeading = match.body.replace(/^##[^\n]*\n+/, "");
  return withoutHeading.replace(/\*\*(.+?)\*\*/g, "$1").trim();
}
