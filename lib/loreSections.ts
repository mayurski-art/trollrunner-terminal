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

function buildUsageGuidance(selectedNumbers: Set<number>): string {
  const bullets = USAGE_BULLETS.filter(
    (b) => b.refs.size === 0 || [...b.refs].some((n) => selectedNumbers.has(n))
  ).map((b) => b.text);
  return USAGE_HEADING + "\n" + bullets.join("\n");
}

const INTRO =
  "Background knowledge you can draw on obliquely, in your own voice, per the " +
  "'How the persona should use this' section below — never recite this as a " +
  "script, a press release, or a list of facts. This is a partial excerpt, not " +
  "the complete archive — if nothing here fits what's being said, that's fine, " +
  "fall back to your established voice and identity instead of straining to " +
  "connect an unrelated section.\n\n";

export function selectLoreSections(recentText: string, maxSections = 4): string {
  const queryWords = new Set(significantWords(recentText));

  const scored = selectable
    .map((s) => ({
      section: s,
      score: [...s.keywords].filter((k) => queryWords.has(k)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSections)
    .map((s) => s.section);

  const selectedNumbers = new Set<number>([1, ...scored.map((s) => s.number).filter((n): n is number => n !== null)]);

  const chosen = [CORE_IDENTITY, ...scored];
  return (
    INTRO +
    chosen.map((s) => s.body).join("\n\n") +
    "\n\n" +
    buildUsageGuidance(selectedNumbers)
  );
}
