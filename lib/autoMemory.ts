import Anthropic from "@anthropic-ai/sdk";
import type { getServiceClient } from "@/lib/supabase";
import type { ChatMessage } from "@/lib/persona";

// The terminal remembers each troublemaker on its own — no [remember]
// button. Every UPDATE_EVERY user turns (and whenever they [clear]) a small
// Claude call rewrites a short notes file about them from the old notes plus
// the recent conversation. The notes live in terminal_user_notes, tied to
// the account, so they follow the person across devices and survive a clear.

type Supabase = ReturnType<typeof getServiceClient>;

export type UserNotes = { notes: string; turnsSinceUpdate: number };

const UPDATE_EVERY = 4;
const MAX_NOTES_CHARS = 1500;
const CONTEXT_TURNS = 16; // rows, not exchanges — covers UPDATE_EVERY turns with room to spare

// Never throws — a missing table (migration 024 not run) or failed read just
// means the terminal chats without notes.
export async function loadUserNotes(supabase: Supabase, userId: string): Promise<UserNotes> {
  try {
    const { data, error } = await supabase
      .from("terminal_user_notes")
      .select("notes, turns_since_update")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("[autoMemory] could not load:", error.message);
      return { notes: "", turnsSinceUpdate: 0 };
    }
    return { notes: data?.notes ?? "", turnsSinceUpdate: data?.turns_since_update ?? 0 };
  } catch (err) {
    console.error("[autoMemory] could not load:", (err as Error).message);
    return { notes: "", turnsSinceUpdate: 0 };
  }
}

export function userNotesBlock(notes: string): string {
  if (!notes.trim()) return "";
  return (
    "\n\nWhat you remember about this troublemaker from past conversations (your own private " +
    "notes — they may have cleared the chat since, but you still know them). Use it the way a " +
    "person uses memory: bring things back when they fit, pick up running jokes, don't re-ask " +
    "what you already know. Never recite the notes, list them, or say you keep notes:\n" +
    notes
  );
}

const NOTES_SYSTEM_PROMPT = `You keep the private memory notes for Trollface Terminal, a chat persona, about
ONE person it talks to (a "troublemaker"). Given the current notes and the
latest stretch of conversation, return the updated notes.

Keep what's worth remembering next time: what they go by, what they're into
or asked about, opinions and stances, running jokes and bits between them,
anything they asked the terminal to remember, how they like to be talked to,
promises or threads left open. Drop small talk and anything the terminal
said that isn't about them. Merge, don't just append — rewrite stale facts
when newer ones replace them, keep the whole thing under ~${Math.round(MAX_NOTES_CHARS * 0.8)} characters,
short "- " bullet lines, plain text. Refer to them by name or "they" — don't
guess gender from a name. Never record passwords, keys, wallet
seed phrases, or other secrets, even if they shared one. If nothing new is
worth keeping, return the current notes unchanged.`;

// Rewrites the notes when enough turns have passed, otherwise just counts
// this turn. force = rewrite now (used on [clear], before the transcript it
// would learn from is gone). Never throws.
export async function updateUserNotes(
  supabase: Supabase,
  userId: string,
  current: UserNotes,
  recent: ChatMessage[],
  { force = false }: { force?: boolean } = {}
): Promise<Anthropic.Messages.Usage | null> {
  try {
    const turns = current.turnsSinceUpdate + (force ? 0 : 1);
    if (!force && turns < UPDATE_EVERY) {
      await supabase
        .from("terminal_user_notes")
        .upsert({ user_id: userId, notes: current.notes, turns_since_update: turns });
      return null;
    }
    if (recent.length === 0) return null;

    const transcript = recent
      .slice(-CONTEXT_TURNS)
      .map((m) => `${m.role === "user" ? "troublemaker" : "terminal"}: ${m.content}`)
      .join("\n");
    const response = await new Anthropic().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: NOTES_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content:
            `Current notes:\n${current.notes || "(none yet — first time)"}\n\n` +
            `Latest conversation:\n${transcript}\n\n` +
            "Return ONLY the updated notes.",
        },
      ],
    });
    const text = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .slice(0, MAX_NOTES_CHARS);

    const { error } = await supabase.from("terminal_user_notes").upsert({
      user_id: userId,
      notes: text || current.notes,
      turns_since_update: 0,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[autoMemory] could not save:", error.message);
    return response.usage;
  } catch (err) {
    console.error("[autoMemory] update failed:", (err as Error).message);
    return null;
  }
}
