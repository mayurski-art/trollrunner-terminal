// PROBLEMS -> $TROLL redemption maths — docs/VAULT-TROLL-REWARDS.md Path B.
//
// Shared by the /vault display and the wallet-submission route so a rate is
// converted the same way everywhere. Nothing here touches the database or
// moves a token; it is arithmetic and the rules around it.

/** PROBLEMS balance required before a wallet can be filed for the $TROLL airdrop queue (Path A). */
export const MIN_WALLET_SUBMIT_PROBLEMS = 69;

/**
 * TROLL owed for a PROBLEMS spend at a given rate.
 *
 * Rounded to 6 decimals — far finer than any plausible payout, but bounded
 * so a repeating decimal (5 / 69 = 0.0724637681...) never reaches the
 * database or the screen as a 17-digit float.
 */
export function trollForProblems(problems: number, problemsPerTroll: number): number {
  if (!Number.isFinite(problems) || !Number.isFinite(problemsPerTroll)) return 0;
  if (problems <= 0 || problemsPerTroll <= 0) return 0;
  return Math.round((problems / problemsPerTroll) * 1e6) / 1e6;
}

export type RoundState = {
  id: string;
  problemsPerTroll: number;
  poolTroll: number;
  perUserCap: number | null;
  /** TROLL already committed to paid + pending requests in this round. */
  committedTroll: number;
  label: string | null;
};

/** What's left in the pool after everything already committed. */
export function remainingPool(round: RoundState): number {
  return Math.max(0, Math.round((round.poolTroll - round.committedTroll) * 1e6) / 1e6);
}
