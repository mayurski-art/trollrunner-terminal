// Shared Solana address validation for the vault's wallet submissions
// (docs/VAULT-TROLL-REWARDS.md Path A). Used by the client for instant
// feedback and by the server, which never trusts the client's answer.
//
// Deliberately dependency-free: @solana/web3.js is not in this project and
// pulling it in to call PublicKey's constructor would be a large dependency
// for one format check. A base58 decode to exactly 32 bytes is the same
// check that constructor performs, minus the curve validation — which is
// not something we want anyway, since a valid destination can be off-curve
// (a PDA) or on-curve (a normal wallet).

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((c, i) => [c, i]));

// Base58 has no 0, O, I or l — the characters most often confused when
// someone retypes an address by hand instead of pasting it.
export const CONFUSABLE_CHARS = /[0OIl]/;

/**
 * Decodes base58 and checks the result is exactly 32 bytes, which is what a
 * Solana public key is. Returns false for anything else.
 */
export function isValidSolanaAddress(raw: string): boolean {
  const address = raw.trim();
  // 32 bytes of base58 always lands in this range; cheap pre-filter so the
  // decode loop never runs on obviously wrong input.
  if (address.length < 32 || address.length > 44) return false;

  // Each leading '1' in base58 is one leading zero byte; the rest of the
  // string carries the significant bytes. Counting them separately keeps
  // the all-'1's system-program address (32 zero bytes, zero significant
  // bytes) from being off by one.
  let leadingZeros = 0;
  for (const char of address) {
    if (char !== "1") break;
    leadingZeros++;
  }

  const bytes: number[] = [];
  for (const char of address.slice(leadingZeros)) {
    const value = BASE58_INDEX.get(char);
    if (value === undefined) return false; // not base58

    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      const total = bytes[i] * 58 + carry;
      bytes[i] = total & 0xff;
      carry = total >> 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Any character in the leading run still has to be valid base58 — '1' is,
  // so the slice above can only have skipped legal characters.
  return bytes.length + leadingZeros === 32;
}

/**
 * A short, human-readable reason the address was rejected, for inline form
 * feedback. Returns null when the address is valid.
 */
export function describeAddressProblem(raw: string): string | null {
  const address = raw.trim();
  if (!address) return "paste an address first";
  if (address.length < 32) return "too short for a solana address";
  if (address.length > 44) return "too long for a solana address";

  const bad = [...address].find((c) => !BASE58_INDEX.has(c));
  if (bad !== undefined) {
    return CONFUSABLE_CHARS.test(bad)
      ? `"${bad}" isn't valid base58 — check for 0/O and I/l mixups`
      : `"${bad}" isn't a valid character in an address`;
  }

  if (!isValidSolanaAddress(address)) return "that isn't a valid solana address";
  return null;
}

/** Middle-truncated form for display: `7xKX…9aBc`. */
export function shortenAddress(address: string, lead = 4, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}
