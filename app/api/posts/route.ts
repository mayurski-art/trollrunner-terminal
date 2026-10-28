import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Public + unauthenticated. This deliberately does NOT return credit/spend
// figures any more — that `usage` object was readable by every visitor via
// a plain curl. It now lives behind requireOwner() at
// /api/admin/credits.
export async function GET() {
  try {
    const supabase = getServiceClient();

    const postsRes = await supabase
      .from("terminal_posts")
      // kind ('clue' | 'musing') is owner-chosen at review time (migration
      // 018) and is public flavor, not a secret like clue_tag — the logs
      // page's filter/label reads it straight off this response.
      .select("id, content, kind, x_post_url, art_url, posted_at, clue_tag")
      // Awaiting the owner accept/trash review — see migration 016.
      .eq("pending", false)
      .is("error", null)
      .order("posted_at", { ascending: false })
      .limit(50);

    if (postsRes.error) {
      return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
    }

    // The logs page's status stamps (app/logs/page.tsx): whether a post can
    // be guessed at all, how many troublemakers cracked it and how many
    // tried. clue_tag itself is the answer, so only its presence goes out.
    const rows = postsRes.data ?? [];
    const { data: guesses } = await supabase
      .from("terminal_post_guesses")
      .select("post_id, correct")
      .in(
        "post_id",
        rows.map((p) => p.id)
      );
    const tally = new Map<string, { cracked: number; tried: number }>();
    for (const g of guesses ?? []) {
      const t = tally.get(g.post_id) ?? { cracked: 0, tried: 0 };
      t.tried += 1;
      if (g.correct) t.cracked += 1;
      tally.set(g.post_id, t);
    }

    return NextResponse.json({
      posts: rows.map(({ clue_tag, ...p }) => ({
        ...p,
        guessable: !!clue_tag,
        cracked: tally.get(p.id)?.cracked ?? 0,
        tried: tally.get(p.id)?.tried ?? 0,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
