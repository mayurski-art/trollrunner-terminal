import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();

    const [postsRes, configRes, costRes] = await Promise.all([
      supabase
        .from("terminal_posts")
        .select("id, content, x_post_url, posted_at")
        .is("error", null)
        .order("posted_at", { ascending: false })
        .limit(50),
      supabase.from("terminal_config").select("starting_credit_usd").single(),
      supabase.from("terminal_posts").select("estimated_cost_usd"),
    ]);

    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }
    if (configRes.error) {
      return NextResponse.json({ error: configRes.error.message }, { status: 500 });
    }
    if (costRes.error) {
      return NextResponse.json({ error: costRes.error.message }, { status: 500 });
    }

    const startingCreditUsd = Number(configRes.data?.starting_credit_usd ?? 0);
    const spentUsd = (costRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
      0
    );
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
