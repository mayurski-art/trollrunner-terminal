import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generateChatReply, type ChatMessage } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 30;

const COOLDOWN_MS = 15_000;
const MAX_MESSAGES_PER_DAY = 60;
const QUALIFYING_MIN_LENGTH = 12;
const QUALIFYING_INTERVAL = 7; // messages per 1 PROBLEM
const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_TURNS = 12;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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
      .select("role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_TURNS * 2),
    supabase.from("terminal_wallets").select("balance, qualifying_count").eq("user_id", userId).maybeSingle(),
  ]);

  return NextResponse.json({
    messages: (historyRows ?? []).slice().reverse(),
    wallet: {
      balance: wallet?.balance ?? 0,
      qualifyingCount: wallet?.qualifying_count ?? 0,
      qualifyingInterval: QUALIFYING_INTERVAL,
    },
  });
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

  // Load recent history for context.
  const { data: historyRows } = await supabase
    .from("terminal_chat_messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_TURNS);

  const history: ChatMessage[] = (historyRows ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      role: r.role === "terminal" ? "assistant" : "user",
      content: r.content as string,
    }));

  const lastUserMessage = [...(historyRows ?? [])].find((r) => r.role === "user")?.content;
  const qualifying =
    message.length >= QUALIFYING_MIN_LENGTH && message !== lastUserMessage;

  let generated: Awaited<ReturnType<typeof generateChatReply>>;
  try {
    generated = await generateChatReply([...history, { role: "user", content: message }]);
  } catch (err) {
    return NextResponse.json(
      { error: `the terminal glitched: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const estimatedCostUsd = estimateCostUsd(generated.usage, "claude-sonnet-5");

  await supabase.from("terminal_chat_messages").insert([
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
    },
  ]);

  // Mining: every QUALIFYING_INTERVAL qualifying messages mints 1 PROBLEM.
  const newQualifyingCount = wallet.qualifying_count + (qualifying ? 1 : 0);
  const minted = Math.floor(newQualifyingCount / QUALIFYING_INTERVAL);
  const remainder = newQualifyingCount % QUALIFYING_INTERVAL;
  const newBalance = wallet.balance + minted;

  await supabase.from("terminal_wallets").upsert({
    user_id: userId,
    balance: newBalance,
    lifetime_earned: wallet.lifetime_earned + minted,
    lifetime_spent: wallet.lifetime_spent,
    qualifying_count: remainder,
    messages_today: messagesToday + 1,
    last_message_at: new Date().toISOString(),
    last_message_day: today,
  });

  if (minted > 0) {
    await supabase.from("terminal_token_ledger").insert({
      user_id: userId,
      delta: minted,
      reason: "mined",
    });
  }

  await supabase
    .from("terminal_config")
    .update({ chat_messages_today: globalToday + 1, chat_messages_day: today })
    .eq("id", true);

  return NextResponse.json({
    reply: generated.content,
    wallet: {
      balance: newBalance,
      qualifyingCount: remainder,
      qualifyingInterval: QUALIFYING_INTERVAL,
    },
    minted,
  });
}
