import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "trollsoneth";
// An NFT floor moves far more slowly than an AMM token price — this
// collection sees single-digit sales a day — so a 5 minute cache is plenty
// fresh, and it keeps us well clear of any unpublished rate limit on
// OpenSea's keyless endpoint no matter how much traffic the site takes.
const REVALIDATE_SECONDS = 300;

export async function GET() {
  try {
    const res = await fetch(
      `https://api.opensea.io/api/v2/collections/${COLLECTION}/stats`,
      { headers: { accept: "application/json" }, next: { revalidate: REVALIDATE_SECONDS } },
    );
    if (!res.ok) throw new Error(`opensea ${res.status}`);

    const data = await res.json();
    const floorEth = Number(data?.total?.floor_price);
    if (!Number.isFinite(floorEth) || floorEth <= 0) throw new Error("no floor");

    // OpenSea quotes the floor in ETH only, so convert for the USD figure.
    // A failed conversion is not fatal — the ticker can show ETH alone.
    let floorUsd: number | null = null;
    try {
      const ethRes = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
        next: { revalidate: REVALIDATE_SECONDS },
      });
      if (ethRes.ok) {
        const ethData = await ethRes.json();
        const spot = Number(ethData?.data?.amount);
        if (Number.isFinite(spot) && spot > 0) floorUsd = floorEth * spot;
      }
    } catch {
      // fall through with floorUsd null
    }

    return NextResponse.json({ floorEth, floorUsd });
  } catch {
    // Same contract as /api/troll-price: no number beats a wrong number.
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
