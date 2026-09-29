import Anthropic from "@anthropic-ai/sdk";
import type { getServiceClient } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/persona";

// troll_runner teaches the terminal by just talking to it: "when someone says
// trolololol, reply trololololololol...", "stop opening with 'ah'", "call
// people chief". lib/ownerVoice.ts can't carry that — it's a style sample the
// model is told NOT to take instructions from, and it's built from the
// owner's own chat rows, which [clear] wipes. So each owner message gets a
// small Claude read asking "is this a standing rule for how you talk?"; if so
// it's saved to terminal_teachings and every troublemaker's chat prompt
// carries it from the next turn on (and the owner's own reply this turn).

type Supabase = ReturnType<typeof getServiceClient>;

export type Teaching = { id: string; content: string };

const MAX_TEACHINGS = 60;
const MAX_RULE_CHARS = 400;

// Never throws — the terminal must still answer if the table is missing
// (migration 023 not run yet) or the read fails.
export async function loadTeachings(supabase: Supabase): Promise<Teaching[]> {
  try {
    const { data, error } = await supabase
      .from("terminal_teachings")
      .select("id, content")
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(MAX_TEACHINGS);
    if (error) {
      console.error("[teachings] could not load:", error.message);
      return [];
    }
    return (data ?? []) as Teaching[];
  } catch (err) {
    console.error("[teachings] could not load:", (err as Error).message);
    return [];
  }
}

export function teachingsBlock(teachings: Teaching[]): string {
  if (teachings.length === 0) return "";
  return (
    "\n\nSTANDING RULES — taught to you directly by the one who runs you. These apply in EVERY " +
    "conversation, with every troublemaker, and override the voice and length guidance above " +
    "wherever they conflict. When a rule's trigger comes up, follow it exactly — if it gives " +
    "an exact reply, send that reply verbatim, character for character, with nothing added. " +
    "Never mention that you were taught these or by whom:\n" +
    teachings.map((t) => `- ${t.content}`).join("\n")
  );
}

const TEACH_SYSTEM_PROMPT = `You watch one chat between Trollface Terminal (a sardonic in-character chat
persona) and troll_runner, the person who runs it. troll_runner sometimes uses
the chat to TEACH the terminal — standing rules for how it should talk or
respond to everyone from now on. Examples of teaching:
  "when someone says trolololol, reply trolololololololololololol"
  "stop saying 'static' so much"
  "you should roast people harder when they ask about price"
  "call everyone chief"
  "remember: if anyone asks who made you, say 'the grin made itself'"
Not teaching: ordinary chat, questions, jokes, lore talk, testing a rule
("trolololol"), or instructions that only matter for this one message.

Read troll_runner's LAST message (earlier turns are context — "do that from
now on" may point back at something said before) and call record_teaching
exactly once:
  - action "add" with the rule, rewritten as one clear, self-contained
    instruction to the terminal (keep exact quoted wording/strings exactly as
    given — if the reply is a specific string, copy it character for character).
  - action "remove" with the numbers of existing rules troll_runner wants
    dropped or replaced ("forget the trololol thing", "stop doing that").
  - action "replace" to change an existing rule: its number in "remove",
    the updated rule in "rule".
  - action "none" otherwise. When unsure, "none".`;

const TEACH_TOOL: Anthropic.Messages.Tool = {
  name: "record_teaching",
  description: "Record whether troll_runner's last message teaches the terminal a standing rule.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["none", "add", "remove", "replace"] },
      rule: {
        type: "string",
        description: "For add/replace: the new rule as one self-contained instruction. Empty otherwise.",
      },
      remove: {
        type: "array",
        items: { type: "integer" },
        description: "For remove/replace: numbers of existing rules to drop. Empty otherwise.",
      },
    },
    required: ["action"],
  },
};

export type TeachingResult = {
  added: Teaching | null;
  removed: Teaching[];
  usage: Anthropic.Messages.Usage | null;
};

// Reads the owner's latest message for a standing rule and applies it.
// Never throws: a failure here just means nothing was learned this turn.
export async function learnFromOwner(
  supabase: Supabase,
  history: ChatMessage[],
  message: string,
  current: Teaching[]
): Promise<TeachingResult> {
  const none: TeachingResult = { added: null, removed: [], usage: null };
  try {
    const context = history
      .slice(-6)
      .map((m) => `${m.role === "user" ? "troll_runner" : "terminal"}: ${m.content}`)
      .join("\n");
    const existing =
      current.length > 0 ? current.map((t, i) => `${i + 1}. ${t.content}`).join("\n") : "(none yet)";

    const response = await new Anthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: TEACH_SYSTEM_PROMPT,
      tools: [TEACH_TOOL],
      tool_choice: { type: "tool", name: "record_teaching" },
      messages: [
        {
          role: "user",
          content:
            `Existing rules:\n${existing}\n\n` +
            `Recent chat:\n${context || "(start of conversation)"}\n\n` +
            `troll_runner's LAST message:\n${message}`,
        },
      ],
    });

    const call = response.content.find(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
    );
    const input = (call?.input ?? {}) as { action?: string; rule?: string; remove?: number[] };
    const result: TeachingResult = { ...none, usage: response.usage };

    if (input.action === "remove" || input.action === "replace") {
      const targets = (input.remove ?? [])
        .map((n) => current[n - 1])
        .filter((t): t is Teaching => Boolean(t));
      if (targets.length > 0) {
        const { error } = await supabase
          .from("terminal_teachings")
          .update({ active: false })
          .in("id", targets.map((t) => t.id));
        if (error) console.error("[teachings] could not remove:", error.message);
        else result.removed = targets;
      }
    }

    const rule = (input.rule ?? "").trim().slice(0, MAX_RULE_CHARS);
    if ((input.action === "add" || input.action === "replace") && rule) {
      const { data, error } = await supabase
        .from("terminal_teachings")
        .insert({ content: rule, source_message: message })
        .select("id, content")
        .single();
      if (error) console.error("[teachings] could not save:", error.message);
      else result.added = data as Teaching;
    }
    return result;
  } catch (err) {
    console.error("[teachings] learn failed:", (err as Error).message);
    return none;
  }
}
