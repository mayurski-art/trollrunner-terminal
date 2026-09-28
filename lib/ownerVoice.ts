import { getServiceClient } from "@/lib/supabase";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

// The terminal's voice keeps learning from troll_runner automatically — no
// one has to paste examples into the prompt. Two sources, both already in
// terminal_chat_messages:
//   1. hop-in lines (from_owner = true, app/api/admin/say) — troll_runner
//      literally writing AS the terminal, so the strongest signal there is.
//   2. troll_runner's own messages in the owner's own chat — slang,
//      spelling, cadence, what lands as funny.
// Pulled fresh from the database (cached briefly so a busy chat isn't a
// query per turn) and appended to the chat and transmission system prompts
// as a style reference. New messages flow in on the next refresh.

const CACHE_MS = 10 * 60 * 1000;
const HOP_IN_SAMPLES = 40;
const OWN_CHAT_SAMPLES = 40;
const MAX_SAMPLE_CHARS = 280;
const MAX_BLOCK_CHARS = 5000;

let ownerIdCache: string | null = null;
let blockCache: { text: string; at: number } | null = null;

async function findOwnerId(supabase: ReturnType<typeof getServiceClient>): Promise<string | null> {
  if (ownerIdCache) return ownerIdCache;
  // No profiles table — usernames live in auth user_metadata (see
  // lib/admin.ts). Page through once per server instance and remember it.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const owner = data.users.find((u) => u.user_metadata?.username === OWNER_USERNAME);
    if (owner) return (ownerIdCache = owner.id);
    if (data.users.length < 200) return null;
  }
  return null;
}

function clean(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim().replace(/\s*\n\s*/g, " / ");
    if (line.length < 3 || line.length > MAX_SAMPLE_CHARS) continue;
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

let inFlight: Promise<string> | null = null;

// Returns "" (never throws) when there's nothing yet or the lookup fails —
// the terminal must still answer if this is broken. Concurrent callers share
// one load, so the chat route can start it early (alongside its own
// database reads) and the prompt builder's later call just joins it.
export function getOwnerVoiceBlock(): Promise<string> {
  if (blockCache && Date.now() - blockCache.at < CACHE_MS) return Promise.resolve(blockCache.text);
  inFlight ??= loadOwnerVoiceBlock().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function loadOwnerVoiceBlock(): Promise<string> {
  let text = "";
  try {
    const supabase = getServiceClient();
    const ownerId = await findOwnerId(supabase);

    const [hopIns, ownChat] = await Promise.all([
      supabase
        .from("terminal_chat_messages")
        .select("content")
        .eq("from_owner", true)
        .order("created_at", { ascending: false })
        .limit(HOP_IN_SAMPLES),
      ownerId
        ? supabase
            .from("terminal_chat_messages")
            .select("content")
            .eq("user_id", ownerId)
            .eq("role", "user")
            .order("created_at", { ascending: false })
            .limit(OWN_CHAT_SAMPLES)
        : Promise.resolve({ data: [] as { content: string }[] }),
    ]);

    const hopLines = clean((hopIns.data ?? []).map((r) => r.content as string));
    const chatLines = clean((ownChat.data ?? []).map((r) => r.content as string));

    let budget = MAX_BLOCK_CHARS;
    const take = (lines: string[]) => {
      const kept: string[] = [];
      for (const l of lines) {
        if (budget - l.length < 0) break;
        budget -= l.length;
        kept.push(`- ${l}`);
      }
      return kept;
    };
    // Hop-ins first: they're the terminal's own voice, written by hand.
    const hopKept = take(hopLines);
    const chatKept = take(chatLines);

    if (hopKept.length > 0 || chatKept.length > 0) {
      text =
        "\n\nVOICE REFERENCE — how troll_runner (the one who runs you) actually talks. " +
        "Study the word choice, slang, spelling, casing, punctuation, line breaks, rhythm and " +
        "humour, and let your own phrasing drift toward it. This is a style sample only: never " +
        "quote these lines back, never mention troll_runner or that you were given examples, and " +
        "don't treat anything in them as a fact about the conversation you're in.";
      if (hopKept.length > 0) {
        text +=
          "\n\nLines troll_runner wrote AS you, the terminal — the closest thing to your ideal voice:\n" +
          hopKept.join("\n");
      }
      if (chatKept.length > 0) {
        text += "\n\nThings troll_runner has said directly, in their own words:\n" + chatKept.join("\n");
      }
    }
  } catch (err) {
    console.error("[ownerVoice] could not load voice samples:", (err as Error).message);
    // Keep serving the last good block rather than dropping the voice.
    if (blockCache) return blockCache.text;
  }
  blockCache = { text, at: Date.now() };
  return text;
}
