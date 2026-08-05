import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { computeDailyReport, yesterdayUtc } from "@/lib/dailyReport";

export const runtime = "nodejs";
export const maxDuration = 30;

// Finalizes yesterday's (UTC) API spend into terminal_daily_spend_reports —
// see the [ reports ] page. Triggered once a day, right after UTC midnight,
// by an external pinger (same cron-job.org pattern as /api/cron and the
// retired /api/musing-cron — see README). UTC midnight currently lands at
// 5pm PDT, which is why "once daily, right after 00:00 UTC" also satisfies
// "every 5pm PST" without any extra timezone logic.
//
// Accepts an optional ?date=YYYY-MM-DD (UTC) to backfill/recompute a
// specific past day manually — upsert makes re-running any date safe.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") || yesterdayUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const supabase = getServiceClient();
  const report = await computeDailyReport(supabase, date);

  const { error } = await supabase.from("terminal_daily_spend_reports").upsert({
    report_date: report.reportDate,
    chat_cost_usd: report.chatCostUsd,
    undervoice_cost_usd: report.undervoiceCostUsd,
    posts_cost_usd: report.postsCostUsd,
    total_cost_usd: report.totalCostUsd,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true, report });
}
