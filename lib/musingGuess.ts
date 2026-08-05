// Muse guessing game — grading. Pure and deterministic given its inputs;
// the model never sees or scores a guess, it only ever produces the
// answer_tag at musing-generation time (see generateMusing in persona.ts).

export const GUESS_COST = 1;
export const MAX_ATTEMPTS = 2;
// Correct guess gets the entry cost back plus this on top.
export const CORRECT_BONUS = 2;

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "at", "for",
  "with", "is", "was", "it", "its", "that", "this", "his", "her",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

// A guess is correct if it's a near-exact match to the tag, or if it
// contains most of the tag's meaningful words (order/phrasing don't have
// to match — "trollsoneth" hitting inside "the trollsoneth nft collection"
// counts, so does "3333 nft" for the same tag).
export function gradeGuess(guess: string, answerTag: string): boolean {
  const normGuess = normalize(guess);
  const normAnswer = normalize(answerTag);
  if (!normGuess || !normAnswer) return false;
  if (normGuess === normAnswer) return true;

  const required = significantTokens(answerTag);
  if (required.length === 0) return normGuess.includes(normAnswer);

  const matched = required.filter((word) => normGuess.includes(word));
  return matched.length / required.length >= 0.6;
}
