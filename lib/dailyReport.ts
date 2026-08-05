import type { getServiceClient } from "@/lib/supabase";

type SupabaseClient = ReturnType<typeof getServiceClient>;

export type DailyReport = {
  reportDate: string;
  chatCostUsd: number;
  undervoiceCostUsd: number;
  postsCostUsd: number;
  totalCostUsd: number;
};

// Sums estimated_cost_usd across the three actual cost sources — chat,
// Undervoice, and broadcast posts ("transmissions") — for one UTC calendar
// day. Same summing pattern as lib/budget.ts's getRemainingUsd, just
// bucketed by source and scoped to a single day instead of all-time.
export async function computeDailyReport(supabase: SupabaseClient, date: string): Promise<DailyReport> {
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  const [chatRes, undervoiceRes, postsRes] = await Promise.all([
    supabase
      .from("terminal_chat_messages")
      .select("estimated_cost_usd")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),
    supabase
      .from("terminal_undervoice_messages")
      .select("estimated_cost_usd")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd),
    supabase
      .from("terminal_posts")
      .select("estimated_cost_usd")
      .gte("posted_at", dayStart)
      .lte("posted_at", dayEnd),
  ]);

  const sum = (rows: { estimated_cost_usd: number | null }[] | null) =>
    (rows ?? []).reduce((total, row) => total + Number(row.estimated_cost_usd ?? 0), 0);

  const chatCostUsd = sum(chatRes.data);
  const undervoiceCostUsd = sum(undervoiceRes.data);
  const postsCostUsd = sum(postsRes.data);

  return {
    reportDate: date,
    chatCostUsd,
    undervoiceCostUsd,
    postsCostUsd,
    totalCostUsd: chatCostUsd + undervoiceCostUsd + postsCostUsd,
  };
}

export function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
