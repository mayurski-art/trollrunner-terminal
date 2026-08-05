import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

// Musing generation was retired — it ran on Opus 5 with a live web_search
// tool every 2 hours and was the single largest line in the API spend
// (search results were never even priced in the cost ledger). This route
// stays in place as a harmless no-op so the external cron-job.org pinger
// and the .github/workflows/musing-cron.yml manual-dispatch fallback don't
// start 404ing — it just never calls the model.
export async function GET() {
  return NextResponse.json({ skipped: true, reason: "disabled" });
}
