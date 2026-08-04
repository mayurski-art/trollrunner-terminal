import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();

    const [postsRes, configRes, postCostRes, chatCostRes, musingCostRes] = await Promise.all([
      supabase
        .from("terminal_posts")
        .select("id, content, x_post_url, posted_at")
        .is("error", null)
        .order("posted_at", { ascending: false })
        .limit(50),
      supabase.from("terminal_config").select("starting_credit_usd").single(),
      supabase.from("terminal_posts").select("estimated_cost_usd"),
      // Chat runs on the same ANTHROPIC_API_KEY as the broadcast cron, so it
      // draws against the same console.anthropic.com balance — leaving it
      // out here would silently understate real spend.
      supabase.from("terminal_chat_messages").select("estimated_cost_usd"),
      // Same for musings (see /api/musing-cron) — same key, same balance.
      supabase.from("terminal_musings").select("estimated_cost_usd"),
    ]);

    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }
    if (configRes.error) {
      return NextResponse.json({ error: configRes.error.message }, { status: 500 });
    }
    if (postCostRes.error) {
      return NextResponse.json({ error: postCostRes.error.message }, { status: 500 });
    }
    if (chatCostRes.error) {
      return NextResponse.json({ error: chatCostRes.error.message }, { status: 500 });
    }
    if (musingCostRes.error) {
      return NextResponse.json({ error: musingCostRes.error.message }, { status: 500 });
    }

    const startingCreditUsd = Number(configRes.data?.starting_credit_usd ?? 0);
    const spentUsd =
      (postCostRes.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0) +
      (chatCostRes.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0) +
      (musingCostRes.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
    const remainingUsd = Math.max(startingCreditUsd - spentUsd, 0);
    const percentUsed =
      startingCreditUsd > 0 ? Math.min((spentUsd / startingCreditUsd) * 100, 100) : 0;

    return NextResponse.json({
      posts: postsRes.data ?? [],
      usage: { startingCreditUsd, spentUsd, remainingUsd, percentUsed },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
