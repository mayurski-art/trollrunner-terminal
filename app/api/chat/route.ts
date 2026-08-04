import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generateChatReply, maybeGenerateGossip, type ChatMessage } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";
import { getBuddyTier, rollBuddyBonus } from "@/lib/buddy";
import { OWNER_USERNAME } from "@/lib/admin";
import { matchLoreAsset } from "@/lib/loreAssets";

export const runtime = "nodejs";
export const maxDuration = 30;

const COOLDOWN_MS = 15_000;
const MAX_MESSAGES_PER_DAY = 60;
const QUALIFYING_MIN_LENGTH = 12;
const QUALIFYING_INTERVAL = 7; // messages per 1 PROBLEM
const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_TURNS = 12;
const RECENT_DUPLICATE_WINDOW = 5; // how many past user messages count as "repeats" for mining
const MIN_UNIQUE_WORD_RATIO = 0.4; // below this, a message reads as one word/phrase looped
const SPAM_WARNING_COUNT = 2; // this many consecutive spammy messages are just warned, not charged

const GOSSIP_COOLDOWN_MESSAGES = 6; // real exchanges required between gossip drops
const GOSSIP_RANDOM_CHANCE = 0.12; // fallback roll when nothing topically matches
const GOSSIP_CANDIDATE_WINDOW_DAYS = 4;
const GOSSIP_STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "to", "of", "in", "on", "at", "for", "with", "about", "that", "this", "it",
  "i", "you", "he", "she", "they", "we", "my", "your", "me", "not", "just",
  "so", "do", "did", "have", "has", "had", "what", "how", "why", "like", "know",
]);

// Overlap of non-trivial words between the owner's message and a candidate
// snippet from another user — cheap enough to run inline, no LLM call needed
// just to decide whether something is "on topic."
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter((w) => w.length >= 4 && !GOSSIP_STOPWORDS.has(w))
  );
}

function sharesTopic(a: string, b: string): boolean {
  const wordsA = significantWords(a);
  if (wordsA.size === 0) return false;
  const wordsB = significantWords(b);
  for (const w of wordsB) {
    if (wordsA.has(w)) return true;
  }
  return false;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeForCompare(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// Blocks "mining" a message that's just spam: a near-repeat of something the
// same user already sent recently, or a single word/phrase looped to pad out
// the length requirement (e.g. "lol lol lol lol lol lol").
function isSpammyMessage(message: string, recentUserMessages: string[]): boolean {
  const normalized = normalizeForCompare(message);
  if (recentUserMessages.some((prev) => normalizeForCompare(prev) === normalized)) {
    return true;
  }
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 4) {
    const uniqueRatio = new Set(words).size / words.length;
    if (uniqueRatio < MIN_UNIQUE_WORD_RATIO) return true;
  }
  return false;
}

// Loads chat history + wallet for the signed-in user, for hydrating the
// chat panel on page load / refresh.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "invalid session" }, { status: 401 });
  }
  const userId = userData.user.id;

  const [{ data: historyRows }, { data: wallet }] = await Promise.all([
    supabase
      .from("terminal_chat_messages")
      .select("role, content, created_at, is_gossip, image_url, image_caption")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS * 2),
    supabase
      .from("terminal_wallets")
      .select("balance, qualifying_count, friendship_score")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const friendshipScore = wallet?.friendship_score ?? 0;

  return NextResponse.json({
    messages: (historyRows ?? []).slice().reverse(),
    wallet: {
      balance: wallet?.balance ?? 0,
      qualifyingCount: wallet?.qualifying_count ?? 0,
      qualifyingInterval: QUALIFYING_INTERVAL,
      friendshipScore,
      buddyTier: getBuddyTier(friendshipScore).name,
    },
  });
}

// Clears this user's chat history only. Wallet (balance, mining progress,
// friendship score) and pinned memories are separate tables and are
// deliberately untouched — "clear" means the terminal forgets the
// conversation transcript, not that the troublemaker loses anything earned.
export async function DELETE(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "invalid session" }, { status: 401 });
  }
  const userId = userData.user.id;

  const { error } = await supabase.from("terminal_chat_messages").delete().eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "could not clear the conversation" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "invalid session" }, { status: 401 });
  }
  const userId = userData.user.id;
  const isOwner = userData.user.user_metadata?.username === OWNER_USERNAME;

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "empty message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: `keep it under ${MAX_MESSAGE_LENGTH} characters` },
      { status: 400 }
    );
  }

  const { data: config } = await supabase
    .from("terminal_config")
    .select("chat_paused, chat_daily_global_cap, chat_messages_today, chat_messages_day")
    .single();

  if (config?.chat_paused) {
    return NextResponse.json(
      { reply: "[signal lost]\nthe terminal is not listening right now", paused: true },
      { status: 200 }
    );
  }

  const today = todayUtc();
  const globalToday = config?.chat_messages_day === today ? config.chat_messages_today : 0;
  if (config && globalToday >= config.chat_daily_global_cap) {
    return NextResponse.json(
      { reply: "the terminal has said enough today\ncome back tomorrow", limited: true },
      { status: 200 }
    );
  }

  // Load or create the wallet row.
  const { data: existingWallet } = await supabase
    .from("terminal_wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const wallet = existingWallet ?? {
    user_id: userId,
    balance: 0,
    lifetime_earned: 0,
    lifetime_spent: 0,
    qualifying_count: 0,
    friendship_score: 0,
    spam_streak: 0,
    messages_today: 0,
    last_message_at: null as string | null,
    last_message_day: null as string | null,
  };

  if (wallet.last_message_at) {
    const elapsed = Date.now() - new Date(wallet.last_message_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      return NextResponse.json(
        { error: "the terminal is ignoring you. try again in a moment" },
        { status: 429 }
      );
    }
  }

  const messagesToday = wallet.last_message_day === today ? wallet.messages_today : 0;
  if (messagesToday >= MAX_MESSAGES_PER_DAY) {
    return NextResponse.json(
      { reply: "you have said enough to it today\nit needs to think", limited: true },
      { status: 200 }
    );
  }

  // Load recent history + pinned memories + the persona's latest private
  // musing (see lib/persona.ts generateMusing) for context.
  const [{ data: historyRows }, { data: memoryRows }, { data: musingRows }] = await Promise.all([
    supabase
      .from("terminal_chat_messages")
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS),
    supabase
      .from("terminal_memories")
      .select("content")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("terminal_musings")
      .select("content")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const memories = (memoryRows ?? []).map((r) => r.content as string);
  const currentMusing = musingRows?.[0]?.content as string | undefined;

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      role: r.role === "terminal" ? "assistant" : "user",
      content: r.content as string,
    }));

  const recentUserMessages = (historyRows ?? [])
    .filter((r) => r.role === "user")
    .slice(0, RECENT_DUPLICATE_WINDOW)
    .map((r) => r.content as string);

  // Spam short-circuits before the LLM call entirely — no reply worth
  // paying for, and it never mines. First two consecutive offenses are just
  // a warning; from the third on it actually costs PROBLEMS, doubling each
  // additional consecutive offense (1, 2, 4, 8, ...) so it stops being
  // free to keep trying.
  if (isSpammyMessage(message, recentUserMessages)) {
    const newSpamStreak = (wallet.spam_streak ?? 0) + 1;
    const penaltyNumber = newSpamStreak - SPAM_WARNING_COUNT;
    const isPenalty = penaltyNumber > 0;
    const tokensRequested = isPenalty ? 2 ** (penaltyNumber - 1) : 0;
    const newBalance = Math.max(0, wallet.balance - tokensRequested);
    const tokensTaken = wallet.balance - newBalance;

    const reply = isPenalty
      ? `[toll taken]\n-${tokensTaken} PROBLEM${tokensTaken === 1 ? "" : "S"} for the repeat\nstop and it stops`
      : newSpamStreak === 1
        ? "[loop detected]\nsay something new or i stop paying attention"
        : "[loop detected again]\nkeep repeating and PROBLEMS start disappearing";

    const { error: spamInsertError } = await supabase.from("terminal_chat_messages").insert([
      { user_id: userId, role: "user", content: message, qualifying: false },
      { user_id: userId, role: "terminal", content: reply, qualifying: false },
    ]);
    if (spamInsertError) console.error("[chat] failed to save chat messages:", spamInsertError.message);

    const { data: persistedWallet, error: walletError } = await supabase
      .from("terminal_wallets")
      .upsert({
        user_id: userId,
        balance: newBalance,
        lifetime_earned: wallet.lifetime_earned,
        lifetime_spent: wallet.lifetime_spent + tokensTaken,
        qualifying_count: wallet.qualifying_count,
        spam_streak: newSpamStreak,
        messages_today: messagesToday + 1,
        last_message_at: new Date().toISOString(),
        last_message_day: today,
      })
      .select("balance, qualifying_count")
      .single();
    if (walletError) console.error("[chat] failed to persist wallet:", walletError.message);

    if (tokensTaken > 0) {
      const { error: ledgerError } = await supabase.from("terminal_token_ledger").insert({
        user_id: userId,
        delta: -tokensTaken,
        reason: "spam_penalty",
      });
      if (ledgerError) console.error("[chat] failed to write ledger entry:", ledgerError.message);
    }

    const { error: configError } = await supabase
      .from("terminal_config")
      .update({ chat_messages_today: globalToday + 1, chat_messages_day: today })
      .eq("id", true);
    if (configError) console.error("[chat] failed to update daily config counters:", configError.message);

    return NextResponse.json({
      reply,
      wallet: {
        balance: persistedWallet?.balance ?? newBalance,
        qualifyingCount: persistedWallet?.qualifying_count ?? wallet.qualifying_count,
        qualifyingInterval: QUALIFYING_INTERVAL,
        friendshipScore: wallet.friendship_score ?? 0,
        buddyTier: getBuddyTier(wallet.friendship_score ?? 0).name,
      },
      walletSaved: !walletError,
      minted: 0,
      buddyBonus: 0,
      spamWarning: !isPenalty,
      tokensTaken,
    });
  }

  const qualifying = message.length >= QUALIFYING_MIN_LENGTH;
  // Computed before the reply so the persona can be told an image is coming
  // — otherwise it has no idea lib/loreAssets.ts is about to attach one and
  // may flatly (and visibly, contradictorily) deny it can show pictures.
  const loreAsset = matchLoreAsset(message);

  let generated: Awaited<ReturnType<typeof generateChatReply>>;
  try {
    generated = await generateChatReply(
      [...history, { role: "user", content: message }],
      memories,
      currentMusing,
      loreAsset?.caption
    );
  } catch (err) {
    return NextResponse.json(
      { error: `the terminal glitched: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const estimatedCostUsd = estimateCostUsd(generated.usage, "claude-sonnet-5");

  const { error: insertError } = await supabase.from("terminal_chat_messages").insert([
    { user_id: userId, role: "user", content: message, qualifying },
    {
      user_id: userId,
      role: "terminal",
      content: generated.content,
      qualifying: false,
      input_tokens: generated.usage.input_tokens,
      output_tokens: generated.usage.output_tokens,
      cache_creation_input_tokens: generated.usage.cache_creation_input_tokens,
      cache_read_input_tokens: generated.usage.cache_read_input_tokens,
      estimated_cost_usd: estimatedCostUsd,
      image_url: loreAsset?.url ?? null,
      image_caption: loreAsset?.caption ?? null,
    },
  ]);
  if (insertError) {
    console.error("[chat] failed to save chat messages:", insertError.message);
  }

  // Gossip — owner account only (see lib/admin.ts). Best-effort: any
  // failure here should never break the normal reply the user is waiting on.
  let gossip: { content: string } | null = null;
  if (isOwner) {
    try {
      const { data: lastGossipRows } = await supabase
        .from("terminal_chat_messages")
        .select("created_at")
        .eq("user_id", userId)
        .eq("is_gossip", true)
        .order("created_at", { ascending: false })
        .limit(1);
      const lastGossipAt = lastGossipRows?.[0]?.created_at as string | undefined;

      const { count: sinceCount } = await supabase
        .from("terminal_chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_gossip", false)
        .gt("created_at", lastGossipAt ?? "1970-01-01");

      if ((sinceCount ?? Infinity) >= GOSSIP_COOLDOWN_MESSAGES) {
        const windowStart = new Date(
          Date.now() - GOSSIP_CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        const { data: candidateRows } = await supabase
          .from("terminal_chat_messages")
          .select("content")
          .eq("role", "user")
          .neq("user_id", userId)
          .gte("created_at", windowStart)
          .order("created_at", { ascending: false })
          .limit(50);
        const candidates = (candidateRows ?? []).map((r) => r.content as string);

        const topical = candidates.find((c) => sharesTopic(message, c));
        const chosen = topical ?? (Math.random() < GOSSIP_RANDOM_CHANCE ? candidates[0] : undefined);

        if (chosen) {
          const gossipContent = await maybeGenerateGossip(chosen);
          if (gossipContent) {
            gossip = { content: gossipContent };
            const { error: gossipInsertError } = await supabase.from("terminal_chat_messages").insert({
              user_id: userId,
              role: "terminal",
              content: gossipContent,
              qualifying: false,
              is_gossip: true,
            });
            if (gossipInsertError) {
              console.error("[chat] failed to save gossip message:", gossipInsertError.message);
            }
          }
        }
      }
    } catch (err) {
      console.error("[chat] gossip generation failed:", (err as Error).message);
    }
  }

  // Mining: every QUALIFYING_INTERVAL qualifying messages mints 1 PROBLEM.
  const newQualifyingCount = wallet.qualifying_count + (qualifying ? 1 : 0);
  const minted = Math.floor(newQualifyingCount / QUALIFYING_INTERVAL);
  const remainder = newQualifyingCount % QUALIFYING_INTERVAL;

  // Buddy system: friendship grows with every real (non-spam) message, and
  // occasionally throws in a bonus PROBLEM regardless of mining progress —
  // see lib/buddy.ts for tiers + odds.
  const newFriendshipScore = (wallet.friendship_score ?? 0) + 1;
  const buddyBonus = rollBuddyBonus(newFriendshipScore);

  const newBalance = wallet.balance + minted + buddyBonus;

  // select() the row back so the response reflects what's actually
  // persisted, not just the in-memory math — a silent upsert failure here
  // used to still report a "minted" reply with numbers that never hit the
  // database (wallet stayed stuck at 0 while chat kept working).
  const { data: persistedWallet, error: walletError } = await supabase
    .from("terminal_wallets")
    .upsert({
      user_id: userId,
      balance: newBalance,
      lifetime_earned: wallet.lifetime_earned + minted + buddyBonus,
      lifetime_spent: wallet.lifetime_spent,
      qualifying_count: remainder,
      friendship_score: newFriendshipScore,
      spam_streak: 0,
      messages_today: messagesToday + 1,
      last_message_at: new Date().toISOString(),
      last_message_day: today,
    })
    .select("balance, qualifying_count, friendship_score")
    .single();
  if (walletError) {
    console.error("[chat] failed to persist wallet:", walletError.message);
  }

  if (minted > 0) {
    const { error: ledgerError } = await supabase.from("terminal_token_ledger").insert({
      user_id: userId,
      delta: minted,
      reason: "mined",
    });
    if (ledgerError) console.error("[chat] failed to write ledger entry:", ledgerError.message);
  }

  if (buddyBonus > 0) {
    const { error: ledgerError } = await supabase.from("terminal_token_ledger").insert({
      user_id: userId,
      delta: buddyBonus,
      reason: "buddy_bonus",
    });
    if (ledgerError) console.error("[chat] failed to write ledger entry:", ledgerError.message);
  }

  const { error: configError } = await supabase
    .from("terminal_config")
    .update({ chat_messages_today: globalToday + 1, chat_messages_day: today })
    .eq("id", true);
  if (configError) console.error("[chat] failed to update daily config counters:", configError.message);

  // Shared TrollRunner XP, same server-enforced rules as the main site
  // (see assets/supabase/troll_terminal_xp.sql) — once per ~day per user,
  // so this is safe to call on every message. Best-effort: a hiccup here
  // shouldn't fail the chat reply the user is waiting on.
  try {
    await supabase.rpc("troll_award_xp_service", {
      p_user_id: userId,
      p_event: "terminal_session",
      p_source: "terminal",
      p_meta: {},
    });
  } catch {
    // ignore
  }

  const persistedFriendshipScore = persistedWallet?.friendship_score ?? newFriendshipScore;

  return NextResponse.json({
    reply: generated.content,
    imageUrl: loreAsset?.url ?? null,
    imageCaption: loreAsset?.caption ?? null,
    gossip,
    wallet: {
      balance: persistedWallet?.balance ?? wallet.balance,
      qualifyingCount: persistedWallet?.qualifying_count ?? wallet.qualifying_count,
      qualifyingInterval: QUALIFYING_INTERVAL,
      friendshipScore: persistedFriendshipScore,
      buddyTier: getBuddyTier(persistedFriendshipScore).name,
    },
    buddyBonus: walletError ? 0 : buddyBonus,
    walletSaved: !walletError,
    minted: walletError ? 0 : minted,
  });
}
