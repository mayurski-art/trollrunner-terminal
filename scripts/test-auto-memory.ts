// Manual check for lib/autoMemory.ts: do notes get written from a real
// conversation, and does a fresh (post-clear) chat actually use them? Uses
// real API keys from .env.local; the database is faked, nothing is saved.
//   npx tsx --env-file=.env.local scripts/test-auto-memory.ts
import { updateUserNotes } from "@/lib/autoMemory";
import { generateChatReply, type ChatMessage } from "@/lib/persona";

let saved: { notes: string; turns_since_update: number } | null = null;
const fake = {
  from: () => ({
    upsert: async (row: { notes: string; turns_since_update: number }) => {
      saved = row;
      return { error: null };
    },
  }),
} as never;

const convo: ChatMessage[] = [
  { role: "user", content: "yo im dave, everyone calls me pickle" },
  { role: "assistant", content: "pickle. noted. brined and suspicious." },
  { role: "user", content: "i'm obsessed with the 2008 rage comics era, grew up on 4chan" },
  { role: "assistant", content: "so you were there when the grin got drawn. respect, sort of." },
  { role: "user", content: "remember my cat is named Borscht, he's a menace" },
  { role: "assistant", content: "borscht the menace. the terminal fears no cat. mostly." },
  { role: "user", content: "also i hate when you say 'troublemaker' lol" },
  { role: "assistant", content: "fine. pickle it is." },
];

(async () => {
  // 3 turns already counted -> this 4th turn triggers a rewrite.
  await updateUserNotes(fake, "u1", { notes: "", turnsSinceUpdate: 3 }, convo);
  const s = saved as { notes: string; turns_since_update: number } | null;
  console.log("NOTES WRITTEN:\n" + (s?.notes ?? "(none)") + `\n(turns reset to ${s?.turns_since_update})\n`);

  const checks = ["pickle", "borscht"].map((w) => (s?.notes ?? "").toLowerCase().includes(w));
  console.log(`${checks.every(Boolean) ? "PASS" : "FAIL"} notes mention pickle + borscht\n`);

  // Counter-only path: 1 turn in, no rewrite.
  saved = null;
  await updateUserNotes(fake, "u1", { notes: "x", turnsSinceUpdate: 0 }, convo);
  console.log(`${(saved as { turns_since_update: number } | null)?.turns_since_update === 1 ? "PASS" : "FAIL"} early turn only bumps the counter\n`);

  // Fresh chat, empty history (as after [clear]), notes supplied.
  for (const q of ["yo do you remember me?", "what's my cat's name again"]) {
    const r = await generateChatReply([{ role: "user", content: q }], [], [], s?.notes ?? "");
    console.log(`"${q}" -> ${JSON.stringify(r.content)}`);
  }
})();
