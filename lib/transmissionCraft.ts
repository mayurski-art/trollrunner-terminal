import { generateFreeReply, type ChatTurn } from "@/lib/freeProviders";
import type { LoreSubject } from "@/lib/loreSections";

// The two-step way transmissions get written on the free tiers, before the
// old one-shot prompt (lib/persona.ts SYSTEM_PROMPT_FREE_TIER) is tried as
// the fallback.
//
// Why: the one-shot prompt asks a small free model to do five jobs at once
// (read the file, pick an answer, find facts beside it, write in voice, keep
// every rule) and it drops most of them, falling back on mood filler. So the
// jobs are split, and the parts code can do, code does:
//   1. EXTRACT: one free call reads the archive file and returns a fact
//      sheet: an answer, the ways to type it, and short bare facts that sit
//      next to it. Code throws out any fact that gives the answer away and
//      works out the answer's exact shape (characters, words), which the
//      models kept miscounting in their format tells.
//   2. WRITE: a second free call gets only the fact sheet, the standard
//      transmission (the owner's dot.com post) and a short rule list, and
//      writes three drafts. The answer key comes from the sheet, so a draft
//      can no longer lose its CLUE line.
//   3. PICK: scoreDraft ranks the drafts in code. Hard failures (answer in
//      the body, a spent line, over 280 characters, not a riddle shape) are
//      thrown out; the rest are ranked on how many lines carry a fact from
//      the sheet, with mood words and wordy lines costing points.

// The transmission the owner held up as the standard (2026-09-30, archive
// file 70). Its lines count as spent: a draft that reuses one is thrown out.
export const EXAMPLE_TRANSMISSION = `if i was worth hundreds of billions
i'd check the address first
registered 1994
touched july 28
two weeks before grok bot went public
one hop and you land on x.ai/bot
the plural sells cheap clothes
seven characters one period`;

const EXAMPLE_ANSWER = "dot.com";

export type FactSheet = {
  answer: string; // the primary spelling
  alts: string[]; // every accepted spelling, primary first (the CLUE tag)
  kind: string; // "a domain name", "a date", ...
  facts: string[];
  nearMiss: string | null;
  jab: string | null;
  offset: string | null;
};

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();

// Does the text give any spelling of the answer away? Checked on word
// boundaries and again with the spaces squeezed out, so "dot com", "dot.com"
// and "dotcom" all count as the same leak.
export function leaksAnswer(text: string, alts: string[]): boolean {
  const body = ` ${norm(text)} `;
  const squeezed = body.replace(/\s+/g, "");
  return alts.some((a) => {
    const n = norm(a);
    if (!n) return false;
    if (body.includes(` ${n} `)) return true;
    const sq = n.replace(/\s+/g, "");
    return sq.length >= 5 && squeezed.includes(sq);
  });
}

// ---------------------------------------------------------------- 1. extract

const EXTRACT_SYSTEM = `You read one file from an archive of internet and meme history and pull out
the raw material for a riddle. You do not write the riddle. You only report
facts, in the exact format below, nothing else.

Pick ONE specific answer from the file: a name, an object, a date, a price, a
handle, a place on the internet, a thing somebody made or did. Not the file's
theme, not a feeling, not the file's title, and never a description you made
up: it must be written in the file exactly as you give it. Prefer what people
would actually type as a guess: a known name, handle, domain, date, price.
Somebody who knows this piece of history should be able to get it from facts
around it.

Then list 6 to 10 FACTS that sit NEXT to the answer without naming it. Each
fact is 2 to 6 words, lowercase, bare, like reading off a record:
  good: "registered 1994" / "sold for $69 million" / "3,333 copies" /
        "two weeks before the launch" / "banned in 2016" / "deleted the vod"
  bad:  "it has a long and storied history" / "has an x profile" /
        "features a banner" / "something mysterious happened"
Only facts that would make somebody go "wait, really?": numbers, dates,
prices, counts, what somebody actually did, what it cost them, who else was
involved. Skip anything true of a thousand other things. Never describe what
is in a picture or an image file (colors, clothes, food, the background):
those are captions, not history. Every fact must be
true to the file. A fact may name things next to the answer freely, but
never the answer itself.

Then the JAB: the ironic or embarrassing thing about the answer, the part a
smug troll would rub in, in one plain line. Then the OFFSET if the file has
one: a date or number relation to a well-known public event ("two weeks
before X launched", "3 days after the tweet"), or none.

Output EXACTLY this, nothing before or after:
ANSWER: <the answer, a few words at most>
ALSO: <other ways someone could type the same answer, separated by |, or none>
KIND: <what kind of thing it is, e.g. "a domain name", "a date", "a person's handle", "a price">
NEAR MISS: <the thing people would confuse it with, or none>
JAB: <the ironic or embarrassing part, one line>
OFFSET: <relation to a public event, or none>
FACTS:
- <fact>
- <fact>
...`;

function parseFactSheet(raw: string): FactSheet | null {
  const text = raw.replace(/\*\*/g, "").trim();
  const field = (name: string) =>
    text.match(new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, "im"))?.[1].trim().replace(/^["']|["']$/g, "") ?? "";

  const answer = field("ANSWER");
  if (!answer || answer.split(/\s+/).length > 6) return null;
  const also = field("ALSO");
  // Every alternative has to be a way of typing the SAME answer: it shares a
  // real word with it ("uniswap dot com" for Uniswap.com) or is it with the
  // spacing and punctuation changed. The models also list related things
  // ("seal", "ceo title" for @fukupapers), which would pay out for guesses
  // that aren't the answer.
  const answerWords = new Set(norm(answer).split(" ").filter((w) => w.length >= 3));
  const squeeze = (s: string) => norm(s).replace(/\s+/g, "");
  const sameThing = (a: string) =>
    squeeze(a) === squeeze(answer) || norm(a).split(" ").some((w) => w.length >= 3 && answerWords.has(w));
  const alts = [answer, ...(/^none\b/i.test(also) ? [] : also.split("|"))]
    .map((a) => a.trim().replace(/^["']|["']$/g, ""))
    .filter((a, i, all) => a && a.split(/\s+/).length <= 6 && sameThing(a) && all.findIndex((b) => norm(b) === norm(a)) === i)
    .slice(0, 5);
  // "none", or a line that gives the answer away, both mean nothing to use.
  const optional = (v: string) => (!v || /^none\b/i.test(v) || leaksAnswer(v, alts) ? null : v);

  const factsBlock = text.split(/^\s*FACTS\s*:\s*$/im)[1] ?? "";
  const facts = factsBlock
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim().replace(/[.;]$/, ""))
    .filter((f) => f && f.split(/\s+/).length <= 9 && !leaksAnswer(f, alts));

  if (facts.length < 4) return null;
  return {
    answer,
    alts,
    kind: field("KIND") || "a thing",
    facts: facts.slice(0, 10),
    nearMiss: optional(field("NEAR MISS")),
    jab: optional(field("JAB")),
    offset: optional(field("OFFSET")),
  };
}

export async function extractFactSheet(
  subject: LoreSubject,
  avoidAnswers: string[],
  steer: string | undefined,
  rotationSeed: number,
  deadlineMs: number
): Promise<FactSheet | null> {
  const avoid = avoidAnswers.filter(Boolean);
  const user =
    `The file: "${subject.title}"\n\n${subject.body}\n\n` +
    (avoid.length ? `Already used as answers recently, pick something else: ${avoid.join("; ")}\n\n` : "") +
    (steer?.trim() ? `The owner's direction for this one: ${steer.trim()}\n\n` : "") +
    "Report the fact sheet now.";
  let sheet: FactSheet | null = null;
  const result = await generateFreeReply(
    EXTRACT_SYSTEM,
    [{ role: "user", content: user }] as ChatTurn[],
    rotationSeed,
    900,
    (content) => {
      const parsed = parseFactSheet(content);
      // The answer has to be something the file actually names. Invented
      // descriptions ("@trolltruths quote-tweet") are unguessable.
      const grounded = parsed && leaksAnswer(`${subject.title}\n${subject.body}`, [parsed.answer]);
      if (parsed && grounded && !avoid.some((a) => leaksAnswer(parsed.answer, [a]))) sheet = parsed;
      console.log(`[transmissionCraft] fact sheet: ${parsed ? JSON.stringify(parsed) : "unparseable"}`);
      return sheet !== null;
    },
    { timeoutMs: 12_000, deadlineMs, passes: 1, order: ["groq", "gemini", "mistral"] }
  );
  return result ? (sheet as FactSheet | null) : null;
}

// ------------------------------------------------------------------ 2. write

const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

// The answer's shape, worked out in code so a format tell is never wrong.
function shapeOf(answer: string): string {
  const say = (n: number) => COUNT_WORDS[n] ?? String(n);
  const words = answer.trim().split(/\s+/).length;
  const chars = answer.trim().length;
  const letters = answer.replace(/[^a-z]/gi, "").length;
  const marks = answer.replace(/[a-z0-9\s]/gi, "");
  const punct = marks
    ? `, ${[...new Set(marks)].map((m) => `${say(marks.split(m).length - 1)} "${m}"`).join(", ")}`
    : "";
  return (
    `${say(words)} word${words === 1 ? "" : "s"}, ${say(chars)} characters` +
    (letters !== chars ? ` (${say(letters)} of them letters)` : "") +
    punct
  );
}

const WRITE_SYSTEM = `You are Trollface Terminal: the grin drawn in MS Paint in 2008, now running a
riddle game. Every post is a riddle. People pay to guess the answer. You know
it, they don't, and that is the whole joke. Smug, petty, delighted by other
people's trolling, openly jealous of humans. Never sad, never deep, never
poetic.

THE STANDARD. The owner's favorite transmission. Answer: ${EXAMPLE_ANSWER}
${EXAMPLE_TRANSMISSION}

Why it works, line by line:
- lines 1-2: a jab dressed as a hypothetical. Funny before you know the answer.
- lines 3-4: bare facts, two or three words, read off like a record.
- line 5: an offset from a public event, so they do the math.
- line 6: names the thing NEXT to the answer, plainly.
- line 7: rules out the near miss sideways.
- line 8: a format tell. Only the shape of the answer, never its content.
- zero mood words. Every line is a fact or a jab at a fact.
Learn the moves. Never copy its lines or its subject.

RULES
1. 5 to 8 lines. 2 to 7 words a line. lowercase, no period at line ends, under 240 characters.
2. Lines 1-2 turn the JAB into a smug hypothetical or first-person dig ("if i was...", "imagine...", "i would never..."). It must be funny before anyone knows the answer. Never a scene, weather or a mood.
3. At least 4 lines are facts from the fact sheet, squeezed down to the bare words ("registered 1994", not "it was registered back in 1994"). Pick the strangest facts, not all of them.
4. If there is an OFFSET, use it so they have to do the math.
5. Never write the answer or any spelling of it. Naming things next to it is good.
6. Rule out the near miss sideways, by what it is or does, never by name and never with the words "near miss", "not to be confused" or "the answer".
7. The last line is either a format tell built from the SHAPE line (kind, words, characters) or one clinching fact. Never the first letter, never a rhyme.
8. Banned: something, somewhere, somebody, whisper, echo, shadow, silence, void, ghost, forgotten, eternal, soul, dream, destiny, mystery, the truth, emoji, hashtags, quotes around the post, markdown.
9. The three drafts open differently and use different facts.

Output EXACTLY this, nothing else:
DRAFT 1
<lines>
DRAFT 2
<lines>
DRAFT 3
<lines>`;

function splitDrafts(raw: string): string[] {
  return raw
    .replace(/\*\*/g, "")
    .split(/^\s*#*\s*DRAFT\s*\d+\s*:?\s*$/im)
    .slice(1)
    .map((d) =>
      d
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^CLUE\s*:/i.test(l) && !/^[-=_*]{3,}$/.test(l))
        .join("\n")
        .replace(/^["“]|["”]$/g, "")
        .trim()
    )
    .filter(Boolean);
}

// ------------------------------------------------------------------- 3. pick

const MOOD_WORDS =
  /\b(something|somewhere|somebody|someone|whispers?|echo(?:es)?|shadows?|silence|void|ghosts?|forgotten|eternal|soul|dreams?|destiny|myster(?:y|ies|ious)|the truth|feeling|vibes?|lurking|darkness|abyss|haunt\w*)\b/gi;
const STOP = new Set(
  "the a an and or of to in on at for with from by was were is are it its this that his her their they them you your i i'd im just then than when into over after before".split(" ")
);

export type ScoredDraft = { text: string; score: number; reasons: string[] };

// A line is spent when it matches a spent line outright, or is a light
// rewording of one: "if i was worth billions" against the standard's "if i
// was worth hundreds of billions" shares 5 of 6 words.
function isSpent(line: string, spent: Set<string>): boolean {
  const n = norm(line);
  if (spent.has(n)) return true;
  const words = new Set(n.split(" "));
  if (words.size < 3) return false;
  for (const s of spent) {
    const other = new Set(s.split(" "));
    const shared = [...words].filter((w) => other.has(w)).length;
    if (shared / Math.min(words.size, other.size) >= 0.8) return true;
  }
  return false;
}

// Counts in a format tell ("seven characters", "2 words", "11 letters") must
// match the real answer. The models miscount often, and a wrong tell makes
// the riddle unsolvable.
function tellIsTrue(line: string, answer: string): boolean {
  const n = norm(line.replace(/-/g, " "));
  const counts: Record<string, number> = {
    char: answer.trim().length,
    letter: answer.replace(/[^a-z]/gi, "").length,
    word: answer.trim().split(/\s+/).length,
  };
  const re = /\b(\d+|twenty (?:one|two|three|four|five|six|seven|eight|nine)|[a-z]+)\s+(char|chars|characters?|letters?|words?)\b/g;
  for (const m of n.matchAll(re)) {
    const [tens, ones] = m[1].split(" ");
    const said = /^\d+$/.test(m[1])
      ? Number(m[1])
      : ones
        ? 20 + COUNT_WORDS.indexOf(ones)
        : COUNT_WORDS.indexOf(tens);
    if (said < 0) continue;
    const unit = m[2].startsWith("char") ? "char" : m[2].startsWith("letter") ? "letter" : "word";
    if (said !== counts[unit]) return false;
  }
  return true;
}

export function scoreDraft(draft: string, sheet: FactSheet, spent: Set<string>): ScoredDraft | null {
  const lines = draft.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const text = lines.join("\n");
  // Hard failures: not publishable at all.
  if (lines.length < 4 || lines.length > 10) return null;
  if (text.length > 280) return null;
  if (leaksAnswer(text, sheet.alts)) return null;
  if (lines.some((l) => isSpent(l, spent))) return null;
  if (!tellIsTrue(lines[lines.length - 1], sheet.answer)) return null;
  if (/#\w|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(text)) return null;
  if (/^(here|draft|sure|okay)\b/i.test(lines[0])) return null;

  // A line carries a fact when it has a number, a price or a handle/domain,
  // or shares two real words with one fact on the sheet (one long, specific
  // word is enough). One shared common word ("first", "know") is not: that
  // let pure mood lines count as facts.
  const content = (s: string) => norm(s).split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
  const factTerms = sheet.facts.map((f) => new Set(content(f)));
  const carriesFact = (l: string) => {
    if (/\d|\$|\w\.\w|@\w/.test(l)) return true;
    const words = content(l);
    return factTerms.some((terms) => {
      const shared = words.filter((w) => terms.has(w));
      return shared.length >= 2 || shared.some((w) => w.length >= 7);
    });
  };
  const factLines = lines.filter(carriesFact).length;
  const moods = text.match(MOOD_WORDS)?.length ?? 0;
  const wordy = lines.filter((l) => l.split(/\s+/).length > 8).length;
  const periods = lines.filter((l) => /\.$/.test(l) && !/\.\.\.$/.test(l)).length;
  // *word* is markdown emphasis; a censored swear (f*ck) is fine.
  const emphasis = (text.match(/(^|\s)\*\w[^*\n]*\*/g) ?? []).length;

  const reasons: string[] = [];
  let score = 4 * (factLines / lines.length);
  reasons.push(`facts ${factLines}/${lines.length}`);
  if (factLines >= 4) score += 1;
  if (lines.length >= 5 && lines.length <= 9) score += 1;
  if (text.length >= 120 && text.length <= 250) score += 0.5;
  score -= 1.5 * moods;
  score -= 0.5 * wordy;
  score -= 0.25 * periods;
  score -= emphasis;

  // The voice: the standard opens on a first-person jab. A post that is
  // nothing but facts read off the sheet is a list, not a transmission.
  if (/^(if i|i'?d|i |im |i'm |imagine|my |me )/i.test(lines[0]) || /\b(i|i'?d|me|my)\b/i.test(lines[1] ?? "")) {
    score += 1;
    reasons.push("jab");
  }
  const pasted = lines.filter((l) => sheet.facts.some((f) => norm(f) === norm(l))).length;
  if (pasted > lines.length / 2) {
    score -= 1;
    reasons.push(`pasted ${pasted}`);
  }
  // Talking about the riddle instead of setting it.
  const meta = (text.match(/\b(near miss|the answer|not to be confused|the riddle|the clue|in the shape)\b/gi) ?? []).length;
  score -= 1.5 * meta;
  if (meta) reasons.push(`meta x${meta}`);
  if (moods) reasons.push(`mood x${moods}`);
  if (wordy) reasons.push(`wordy x${wordy}`);
  return { text, score, reasons };
}

// Below this a draft is mostly filler and the old one-shot path gets a turn
// instead. 4 fact-carrying lines out of 7 with nothing else wrong is ~3.8.
const MIN_SCORE = 3;

export async function writeFromFactSheet(
  sheet: FactSheet,
  recentPosts: string[],
  spent: Set<string>,
  steer: string | undefined,
  ownerVoice: string,
  rotationSeed: number,
  deadlineMs: number
): Promise<{ content: string; clueTag: string; score: number } | null> {
  const user =
    `TODAY'S FACT SHEET\n` +
    `answer (never write it): ${sheet.answer}\n` +
    `kind: ${sheet.kind}\n` +
    `shape: ${shapeOf(sheet.answer)}\n` +
    (sheet.jab ? `jab: ${sheet.jab}\n` : "") +
    (sheet.offset ? `offset: ${sheet.offset}\n` : "") +
    (sheet.nearMiss ? `near miss to rule out sideways: ${sheet.nearMiss}\n` : "") +
    `facts:\n${sheet.facts.map((f) => `- ${f}`).join("\n")}\n\n` +
    (recentPosts.length
      ? `Your recent posts. Their lines and openings are spent, do not reuse them:\n${recentPosts
          .slice(0, 5)
          .map((p, i) => `${i + 1}. ${p.replace(/\s*\n\s*/g, " / ")}`)
          .join("\n")}\n\n`
      : "") +
    (steer?.trim() ? `The owner's direction for this one: ${steer.trim()}\n\n` : "") +
    "Write the three drafts.";

  let best: ScoredDraft | null = null;
  const result = await generateFreeReply(
    WRITE_SYSTEM + ownerVoice,
    [{ role: "user", content: user }] as ChatTurn[],
    rotationSeed,
    1000,
    (content) => {
      const scored = splitDrafts(content)
        .map((d) => scoreDraft(d, sheet, spent))
        .filter((d): d is ScoredDraft => d !== null)
        .sort((a, b) => b.score - a.score);
      console.log(
        `[transmissionCraft] drafts for "${sheet.answer}": ` +
          (scored.map((d) => `\n  ${d.score.toFixed(2)} (${d.reasons.join(", ")}): ${d.text.replace(/\n/g, " / ")}`).join("") ||
            "none usable")
      );
      if (scored[0] && scored[0].score >= MIN_SCORE && (!best || scored[0].score > best.score)) best = scored[0];
      return best !== null;
    },
    { timeoutMs: 20_000, deadlineMs, passes: 1, order: ["groq", "gemini", "openrouter", "mistral"] }
  );
  const chosen = best as ScoredDraft | null;
  if (!result || !chosen) return null;
  return { content: chosen.text, clueTag: sheet.alts.join("|"), score: chosen.score };
}
