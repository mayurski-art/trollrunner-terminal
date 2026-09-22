import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Never statically prerendered — the whole point is a fresh quote.
export const dynamic = "force-dynamic";

// $TRUTHS — the terminal's own coin, paired to $TROLL (see lore §57).
// Same DexScreener-by-mint approach as /api/troll-price; kept as its own
// route (not a ?mint= param on that one) so the two can diverge later
// without one price accidentally regressing the other, and so this one's
// failure never blanks the $TROLL segment the ticker already showed.
const TRUTHS_MINT = "HsryXB2BdWJuRXAY29hDcw2g4BPH57Q5nL1qu8kQpump";

export async function GET() {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${TRUTHS_MINT}`,
      // Re-fetch upstream at most once a minute; every request in between is
      // served from Next's data cache.
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error(`dexscreener ${res.status}`);

    const data = await res.json();
    const pairs: unknown[] = Array.isArray(data?.pairs) ? data.pairs : [];

    // The mint can trade on more than one pair and the array order is not
    // documented as meaningful, so pick the deepest liquidity rather than
    // pairs[0] — a thin pool quotes a price that isn't the real one.
    let best: Record<string, never> | null = null;
    let bestLiquidity = -1;
    for (const raw of pairs) {
      const pair = raw as Record<string, never>;
      const price = Number((pair as { priceUsd?: string }).priceUsd);
      if (!Number.isFinite(price) || price <= 0) continue;
      const liquidity = Number((pair as { liquidity?: { usd?: number } }).liquidity?.usd ?? 0);
      if (liquidity > bestLiquidity) {
        bestLiquidity = liquidity;
        best = pair;
      }
    }
    if (!best) throw new Error("no priced pair");

    const priceUsd = Number((best as { priceUsd?: string }).priceUsd);
    // h24 is the daily move. It can legitimately be absent on a brand-new
    // pair, so distinguish "no data" (null) from a real 0.00% flat day.
    const rawChange = (best as { priceChange?: { h24?: number } }).priceChange?.h24;
    const change24h = Number.isFinite(Number(rawChange)) ? Number(rawChange) : null;

    return NextResponse.json({ priceUsd, change24h });
  } catch {
    // The ticker treats this as "just show the copy, no price" — a stale or
    // invented number on a price line is worse than no number at all.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
