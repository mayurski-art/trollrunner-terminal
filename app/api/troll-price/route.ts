import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Never statically prerendered — the whole point is a fresh quote.
export const dynamic = "force-dynamic";

const TROLL_MINT = "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2";

// DexScreener is free and key-less, so this proxy exists for two other
// reasons: it keeps the outbound call server-side (one cached fetch shared
// by every visitor instead of each browser hammering them directly), and it
// normalizes the response down to the two numbers the ticker actually wants.
export async function GET() {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${TROLL_MINT}`,
      // Re-fetch upstream at most once a minute; every request in between is
      // served from Next's data cache.
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error(`dexscreener ${res.status}`);

    const data = await res.json();
    const pairs: unknown[] = Array.isArray(data?.pairs) ? data.pairs : [];

    // The mint trades on more than one pair and the array order is not
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
