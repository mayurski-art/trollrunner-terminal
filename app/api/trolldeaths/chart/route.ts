import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// $TROLL mint on Solana — same token finance's price chart and tip jar use.
const TROLL_MINT = "5UUH9RTDiSpq6HKS6bp4NdU9PNJpXRXuiw6ShBTBhgH2";

const ALLOWED_RANGES = new Set(["7", "30", "90", "365", "max"]);

// Public + unauthenticated. Proxies CoinGecko server-side so the browser
// never needs a connect-src allowance for an external API — same [price,
// timestamp] series finance's chart renders, just fetched fresh here rather
// than shared, since CoinGecko's contract endpoint is free and unauthed.
export async function GET(req: NextRequest) {
  const daysParam = req.nextUrl.searchParams.get("days") ?? "365";
  const days = ALLOWED_RANGES.has(daysParam) ? daysParam : "365";

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/solana/contract/${TROLL_MINT}/market_chart?vs_currency=usd&days=${days}&precision=full`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) {
      return NextResponse.json({ error: `CoinGecko chart API error (${res.status})` }, { status: 502 });
    }
    const json = await res.json();
    const prices = Array.isArray(json?.prices) ? json.prices : [];
    if (!prices.length) {
      return NextResponse.json({ error: "CoinGecko chart returned no price points" }, { status: 502 });
    }
    return NextResponse.json({ prices });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
