// Manual check for the transmission writer (lib/transmissionCraft.ts via
// generatePost): writes a few transmissions against the real published
// history and prints them with their answer keys. Free providers only, and
// the database is only read, so nothing is posted or saved.
//   npx tsx --env-file=.env.local scripts/test-transmission.ts [runs] [steer]
import { getServiceClient } from "@/lib/supabase";
import { generatePost } from "@/lib/persona";

async function main() {
  const runs = Number(process.argv[2] ?? 3);
  const steer = process.argv[3];
  const { data } = await getServiceClient()
    .from("terminal_posts")
    .select("content, posted_at, clue_tag")
    .eq("pending", false)
    .order("posted_at", { ascending: false })
    .limit(15);
  const recent = (data ?? []).map((r) => ({
    content: r.content as string,
    posted_at: r.posted_at as string,
    clue_tag: r.clue_tag as string | null,
  }));

  for (let i = 0; i < runs; i++) {
    const t = Date.now();
    try {
      const post = await generatePost(recent, Date.now(), steer);
      console.log(`\n--- run ${i + 1} (${((Date.now() - t) / 1000).toFixed(1)}s, ${post.content.length} chars)`);
      console.log(post.content);
      console.log(`CLUE: ${post.clueTag}`);
    } catch (err) {
      console.log(`\n--- run ${i + 1} failed: ${(err as Error).message}`);
    }
  }
}

main();
