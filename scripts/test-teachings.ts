// Manual check for lib/teachings.ts: does the extractor pick up owner rules,
// and does the real reply pipeline follow them? Uses real API keys from
// .env.local; the database is faked for writes, so nothing is saved.
//   npx tsx --env-file=.env.local scripts/test-teachings.ts
import { learnFromOwner, type Teaching } from "@/lib/teachings";
import { generateChatReply } from "@/lib/persona";

const TROLL = "trolololololololololololololololololololololololololololololololol";

function fakeSupabase(log: string[]) {
  return {
    from: () => ({
      insert: (row: { content: string }) => ({
        select: () => ({
          single: async () => {
            log.push(`INSERT ${row.content}`);
            return { data: { id: "new", content: row.content }, error: null };
          },
        }),
      }),
      update: () => ({
        in: async (_col: string, ids: string[]) => {
          log.push(`DEACTIVATE ${ids.join(",")}`);
          return { error: null };
        },
      }),
    }),
  } as never;
}

const seeded: Teaching[] = [
  {
    id: "seed",
    content: `When a troublemaker says "trolololol" (or any spelling of trolol...), reply with exactly: ${TROLL}`,
  },
];

async function extractorCases() {
  const cases: { msg: string; current: Teaching[]; expect: "add" | "none" | "remove" }[] = [
    { msg: `when someone says trolololol you reply ${TROLL}`, current: [], expect: "add" },
    { msg: "from now on call everyone chief", current: [], expect: "add" },
    { msg: "whats the deal with $TROLL lately", current: seeded, expect: "none" },
    { msg: "trolololol", current: seeded, expect: "none" },
    { msg: "forget the trololol thing", current: seeded, expect: "remove" },
  ];
  let pass = 0;
  for (const c of cases) {
    const log: string[] = [];
    await learnFromOwner(fakeSupabase(log), [], c.msg, c.current);
    const got = log.some((l) => l.startsWith("DEACTIVATE"))
      ? "remove"
      : log.some((l) => l.startsWith("INSERT"))
        ? "add"
        : "none";
    const ok = got === c.expect;
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"} extractor "${c.msg.slice(0, 50)}" -> ${got} ${log.join(" | ")}`);
  }
  return { pass, total: cases.length };
}

async function replyCases() {
  const inputs = ["trolololol", "trolololol", "trolololol", "TROLOLOLOL", "trololol lol"];
  let pass = 0;
  for (const msg of inputs) {
    const r = await generateChatReply([{ role: "user", content: msg }], [], seeded);
    const ok = r.content.trim() === TROLL;
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"} reply "${msg}" -> ${JSON.stringify(r.content)} [${r.provider}]`);
  }
  // Control: an ordinary message must NOT get the trolol reply.
  const control = await generateChatReply([{ role: "user", content: "who made you?" }], [], seeded);
  const controlOk = !control.content.includes("trololololol");
  console.log(`${controlOk ? "PASS" : "FAIL"} control "who made you?" -> ${JSON.stringify(control.content)}`);
  return { pass: pass + (controlOk ? 1 : 0), total: inputs.length + 1 };
}

(async () => {
  const a = await extractorCases();
  const b = await replyCases();
  console.log(`\nextractor ${a.pass}/${a.total}, replies ${b.pass}/${b.total}`);
})();
