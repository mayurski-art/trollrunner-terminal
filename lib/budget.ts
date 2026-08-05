import type { getServiceClient } from "@/lib/supabase";

type SupabaseClient = ReturnType<typeof getServiceClient>;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export type UsageSummary = {
  startingCreditUsd: number;
  spentUsd: number;
  remainingUsd: number;
  percentUsed: number;
};

// Sums estimated_cost_usd across every generation surface that draws on the
// same ANTHROPIC_API_KEY / console.anthropic.com balance — chat, undervoice,
// broadcast posts, and (historically) musings. Shared by /api/posts (public
// usage display) and checkAndReserveSpend below (the actual spend guard) so
// there's exactly one definition of "how much have we spent."
export async function getRemainingUsd(supabase: SupabaseClient): Promise<UsageSummary> {
  const [configRes, postCostRes, chatCostRes, undervoiceCostRes, musingCostRes] = await Promise.all([
    supabase.from("terminal_config").select("starting_credit_usd").single(),
    supabase.from("terminal_posts").select("estimated_cost_usd"),
    supabase.from("terminal_chat_messages").select("estimated_cost_usd"),
    supabase.from("terminal_undervoice_messages").select("estimated_cost_usd"),
    supabase.from("terminal_musings").select("estimated_cost_usd"),
  ]);

  const startingCreditUsd = Number(configRes.data?.starting_credit_usd ?? 0);
  const sum = (rows: { estimated_cost_usd: number | null }[] | null) =>
    (rows ?? []).reduce((total, row) => total + Number(row.estimated_cost_usd ?? 0), 0);
  const spentUsd =
    sum(postCostRes.data) + sum(chatCostRes.data) + sum(undervoiceCostRes.data) + sum(musingCostRes.data);
  const remainingUsd = Math.max(startingCreditUsd - spentUsd, 0);
  const percentUsed = startingCreditUsd > 0 ? Math.min((spentUsd / startingCreditUsd) * 100, 100) : 0;

  return { startingCreditUsd, spentUsd, remainingUsd, percentUsed };
}

export type SpendCheck = { allowed: boolean; reason?: "daily_cap" | "low_balance" };

// Pre-check against the running daily total before spending money on a
// generation call. This isn't an exact reservation (the real cost isn't
// known until the model responds), but every generation here is short and
// max_tokens-capped, so worst-case overshoot in a single call is small and
// self-corrects on the very next check.
export async function checkAndReserveSpend(supabase: SupabaseClient): Promise<SpendCheck> {
  const { data: config } = await supabase
    .from("terminal_config")
    .select("daily_spend_cap_usd, spend_today_usd, spend_day, low_balance_pause_usd")
    .single();

  const today = todayUtc();
  const spendToday = config?.spend_day === today ? Number(config.spend_today_usd ?? 0) : 0;
  const dailyCap = Number(config?.daily_spend_cap_usd ?? 0.5);

  if (spendToday >= dailyCap) {
    return { allowed: false, reason: "daily_cap" };
  }

  const lowBalanceFloor = Number(config?.low_balance_pause_usd ?? 2);
  const { remainingUsd } = await getRemainingUsd(supabase);
  if (remainingUsd < lowBalanceFloor) {
    return { allowed: false, reason: "low_balance" };
  }

  return { allowed: true };
}

// Adds costUsd to today's running total (UTC day), resetting the counter
// first if the stored day has rolled over. Call right after estimateCostUsd
// for every chat / undervoice / cron / musing-cron generation.
export async function recordSpend(supabase: SupabaseClient, costUsd: number): Promise<void> {
  const { data: config } = await supabase
    .from("terminal_config")
    .select("spend_today_usd, spend_day")
    .single();

  const today = todayUtc();
  const priorSpend = config?.spend_day === today ? Number(config.spend_today_usd ?? 0) : 0;

  await supabase
    .from("terminal_config")
    .update({ spend_today_usd: priorSpend + costUsd, spend_day: today })
    .eq("id", true);
}
