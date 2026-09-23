import { NextResponse } from "next/server";
import { pickArchiveOfTheDay } from "@/lib/archiveOfTheDay";

// Deliberately public, unlike /api/archive (which is sign-in gated and
// returns unlock state per user). This is the front-page teaser: a title,
// a couple of sentences and one image, for a visitor who may not have an
// account yet — it's the funnel into the archive, so gating it behind the
// thing it's advertising would defeat it.
//
// The full section body is never sent here. Recovering a file still costs
// PROBLEMS through /api/archive.

// Recomputed per request rather than cached: the pick only changes at the
// 5 PM PST rollover, but a cached response would pin `endsAt` (which the
// client counts down against) to whenever the cache was warmed.
export const dynamic = "force-dynamic";

export async function GET() {
  const pick = pickArchiveOfTheDay();
  if (!pick) {
    return NextResponse.json({ error: "no archive sections available" }, { status: 500 });
  }
  return NextResponse.json(pick);
}
