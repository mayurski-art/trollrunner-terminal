// Buddy system — friendship grows the more a troublemaker talks to the
// terminal, purely from message count (spam doesn't count, see chat route).
// Higher tiers get a slightly better shot at a random bonus PROBLEM on any
// given message. Purely a flavor/reward layer on top of the PROBLEMS mining
// loop — never required, never guaranteed.

export const BUDDY_TIERS = [
  { name: "stranger", min: 0 },
  { name: "acquaintance", min: 10 },
  { name: "regular", min: 30 },
  { name: "friend", min: 75 },
  { name: "close friend", min: 150 },
  { name: "ride or die", min: 300 },
] as const;

export function getBuddyTier(friendshipScore: number): { name: string; index: number } {
  let tier: (typeof BUDDY_TIERS)[number] = BUDDY_TIERS[0];
  let index = 0;
  for (let i = 0; i < BUDDY_TIERS.length; i++) {
    if (friendshipScore >= BUDDY_TIERS[i].min) {
      tier = BUDDY_TIERS[i];
      index = i;
    }
  }
  return { name: tier.name, index };
}

// Rolls whether this message earns a surprise "buddy bonus" mint, and how
// much. Chance scales gently with tier so it stays a rare treat, not a
// reliable second income — capped so even a maxed-out buddy is still mostly
// getting PROBLEMS from actual mining, not random rolls.
export function rollBuddyBonus(friendshipScore: number): number {
  const { index } = getBuddyTier(friendshipScore);
  const chance = Math.min(0.04 + index * 0.015, 0.15);
  if (Math.random() >= chance) return 0;
  const roll = Math.random();
  if (roll < 0.6) return 1;
  if (roll < 0.9) return 2;
  return 3;
}
