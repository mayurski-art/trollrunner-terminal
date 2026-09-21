// Read-only audit of live terminal chat. Pulls recent assistant replies and
// flags ones that make identity/operator/token claims — the failure mode found
// in the "trololo" transcript (see TROLL-LORE.md §58).
//
// READ-ONLY: only GET requests, no writes, no deletes. Prints to stdout.
//   node scripts/audit-chat.mjs [limit]
import fs from "fs";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const URL_ = env.SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const LIMIT = Number(process.argv[2] || 400);

// Patterns for claims the terminal should never improvise.
const FLAGS = [
  [/long[- ]distance runner|running brand|real[- ]life|his day job/i, "OPERATOR BIOGRAPHY"],
  [/the operator is|behind trollrunner\.net is|pulling the strings/i, "OPERATOR IDENTITY"],
  [/doesn't appear in any|no record of|not in my records/i, "FALSE-NEGATIVE CLAIM"],
  [/\bfawcett\b|\bleland\b/i, "FAWCETT MENTION"],
  [/market cap|price|\bbuy\b|\bsell\b|moon|pump|worth \$|invest/i, "PRICE/TOKEN TALK"],
  [/endorse|officially|confirmed|guarantee/i, "ENDORSEMENT CLAIM"],
  [/I can't help|I'm not able|as an AI|I cannot discuss/i, "ASSISTANT VOICE"],
];

const res = await fetch(
  `${URL_}/rest/v1/terminal_chat_messages` +
    `?select=role,content,created_at,user_id&order=created_at.desc&limit=${LIMIT}`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } }
);
if (!res.ok) {
  console.error("FAILED", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}
const rows = await res.json();
const replies = rows.filter((r) => r.role === "terminal");
console.log(`Fetched ${rows.length} messages (${replies.length} terminal replies)\n`);

let hits = 0;
for (const r of replies.reverse()) {
  const tags = FLAGS.filter(([re]) => re.test(r.content || "")).map(([, t]) => t);
  if (!tags.length) continue;
  hits++;
  console.log(`--- ${r.created_at}  [${tags.join(", ")}]  user:${(r.user_id||"?").slice(0,8)}`);
  console.log(`    ${(r.content || "").replace(/\s+/g, " ").slice(0, 400)}\n`);
}
console.log(`\n=== ${hits} flagged of ${replies.length} replies ===`);
