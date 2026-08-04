// The Undervoice — outcome resolution. Pure, deterministic given its inputs
// plus Math.random(); the model never sees or influences this file. See
// docs/TERMINAL-V3-DESIGN.md §3 and §5 for why the split matters: the model
// only ever produces a mood tag from a closed enum, and this file is the
// only place that turns tags into token deltas.

export type Mood = "genuine" | "clever" | "hollow" | "hostile" | "flat";
export type Outcome = "refund" | "bonus" | "charge" | "none";

const MOOD_SCORE: Record<Mood, number> = {
  genuine: 2,
  clever: 2,
  flat: 0,
  hollow: -1,
  hostile: -2,
};

export function averageMoodScore(tags: Mood[]): number {
  if (tags.length === 0) return 0;
  const sum = tags.reduce((total, tag) => total + MOOD_SCORE[tag], 0);
  return sum / tags.length;
}

// Cumulative outcome weights per mood bucket — see design doc §5 for the
// reasoning behind these numbers. Order matters: first match under the
// rolled value wins.
type OutcomeTable = { outcome: Outcome; weight: number }[];

function tableFor(avg: number): OutcomeTable {
  if (avg >= 1.2) {
    return [
      { outcome: "none", weight: 0.25 },
      { outcome: "refund", weight: 0.4 },
      { outcome: "bonus", weight: 0.35 },
    ];
  }
  if (avg >= 0.2) {
    return [
      { outcome: "none", weight: 0.6 },
      { outcome: "refund", weight: 0.25 },
      { outcome: "bonus", weight: 0.15 },
    ];
  }
  if (avg >= -0.5) {
    return [
      { outcome: "none", weight: 0.75 },
      { outcome: "refund", weight: 0.1 },
      { outcome: "bonus", weight: 0.05 },
      { outcome: "charge", weight: 0.1 },
    ];
  }
  return [
    { outcome: "none", weight: 0.5 },
    { outcome: "refund", weight: 0.05 },
    { outcome: "bonus", weight: 0.05 },
    { outcome: "charge", weight: 0.4 },
  ];
}

function rollOutcome(avg: number): Outcome {
  const table = tableFor(avg);
  const roll = Math.random();
  let cumulative = 0;
  for (const row of table) {
    cumulative += row.weight;
    if (roll < cumulative) return row.outcome;
  }
  return "none"; // floating-point safety net; weights always sum to 1
}

export type ResolvedOutcome = { outcome: Outcome; delta: number };

// costPaid is the session's entry cost — refund/bonus give it back (bonus
// gives back one extra on top); charge takes one additional PROBLEM beyond
// what's already spent. A session closed with zero messages never gets
// judged — there's nothing to read yet, so it's always a full refund.
export function resolveUndervoiceOutcome(tags: Mood[], costPaid: number): ResolvedOutcome {
  if (tags.length === 0) {
    return { outcome: "refund", delta: costPaid };
  }
  const avg = averageMoodScore(tags);
  const outcome = rollOutcome(avg);
  switch (outcome) {
    case "refund":
      return { outcome, delta: costPaid };
    case "bonus":
      return { outcome, delta: costPaid + 1 };
    case "charge":
      return { outcome, delta: -1 };
    case "none":
      return { outcome, delta: 0 };
  }
}
