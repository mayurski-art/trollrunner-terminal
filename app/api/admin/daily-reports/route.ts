import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import { computeDailyReport, todayUtc } from "@/lib/dailyReport";

export const runtime = "nodejs";
export const maxDuration = 30;

// Owner-only: powers the [ reports ] table — the last 30 finalized days
// from terminal_daily_spend_reports (written by /api/daily-report-cron),
// plus one live "today" entry so the table doesn't sit stale between
// cron runs.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }
  const { supabase } = owner;

  const [{ data: rows, error }, today] = await Promise.all([
    supabase
      .from("terminal_daily_spend_reports")
      .select("report_date, chat_cost_usd, undervoice_cost_usd, posts_cost_usd, total_cost_usd")
      .order("report_date", { ascending: false })
      .limit(30),
    computeDailyReport(supabase, todayUtc()),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const finalized = (rows ?? []).map((r) => ({
    reportDate: r.report_date as string,
    chatCostUsd: Number(r.chat_cost_usd),
    undervoiceCostUsd: Number(r.undervoice_cost_usd),
    postsCostUsd: Number(r.posts_cost_usd),
    totalCostUsd: Number(r.total_cost_usd),
  }));

  return NextResponse.json({ today, reports: finalized });
}
