// PROBLEMS -> $TROLL redemption maths — docs/VAULT-TROLL-REWARDS.md Path B.
//
// Shared by the user route, the admin route and both UIs so a rate is
// converted the same way everywhere. Nothing here touches the database or
// moves a token; it is arithmetic and the rules around it.

/** Floor on a single redemption, matching the XP path's minimum. */
export const MIN_REDEEM_PROBLEMS = 5;

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

/** PROBLEMS needed for a whole TROLL — the number worth showing as a goal. */
export function problemsForOneTroll(problemsPerTroll: number): number {
  return Math.ceil(problemsPerTroll);
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

export type RedeemCheck = { ok: true; troll: number } | { ok: false; error: string };

/**
 * The full set of rules for one redemption attempt. Used by the route as
 * the authority and by the UI to explain a disabled button — same answer
 * in both places, so the form can never invite a spend the server refuses.
 */
export function checkRedemption(params: {
  problems: number;
  balance: number;
  round: RoundState;
  /** PROBLEMS this user has already spent in this round. */
  alreadySpentThisRound: number;
}): RedeemCheck {
  const { problems, balance, round, alreadySpentThisRound } = params;

  if (!Number.isInteger(problems) || problems <= 0) {
    return { ok: false, error: "enter a whole number of PROBLEMS" };
  }
  if (problems < MIN_REDEEM_PROBLEMS) {
    return { ok: false, error: `redeem at least ${MIN_REDEEM_PROBLEMS} PROBLEMS at a time` };
  }
  if (problems > balance) {
    return { ok: false, error: `not enough PROBLEMS — need ${problems}, have ${balance}` };
  }

  if (round.perUserCap !== null) {
    const remainingAllowance = round.perUserCap - alreadySpentThisRound;
    if (remainingAllowance <= 0) {
      return { ok: false, error: `you've hit this round's cap of ${round.perUserCap} PROBLEMS` };
    }
    if (problems > remainingAllowance) {
      return {
        ok: false,
        error: `this round caps you at ${round.perUserCap} PROBLEMS — ${remainingAllowance} left`,
      };
    }
  }

  const troll = trollForProblems(problems, round.problemsPerTroll);
  if (troll <= 0) {
    return { ok: false, error: "that rounds to nothing — redeem more" };
  }

  const left = remainingPool(round);
  if (troll > left) {
    return { ok: false, error: `this round only has ${left} TROLL left` };
  }

  return { ok: true, troll };
}
