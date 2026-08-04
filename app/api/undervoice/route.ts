import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { generateUndervoiceReply, type ChatMessage } from "@/lib/persona";
import { estimateCostUsd } from "@/lib/pricing";
import { resolveUndervoiceOutcome, type Mood } from "@/lib/undervoice";

export const runtime = "nodejs";
export const maxDuration = 30;

const COOLDOWN_MS = 15_000;
const MAX_MESSAGE_LENGTH = 1000;

type Wallet = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
};

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { supabase, userId: data.user.id };
}

async function loadWallet(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<Wallet> {
  const { data } = await supabase
    .from("terminal_wallets")
    .select("balance, lifetime_earned, lifetime_spent")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    balance: data?.balance ?? 0,
    lifetime_earned: data?.lifetime_earned ?? 0,
    lifetime_spent: data?.lifetime_spent ?? 0,
  };
}

// Applies a ledger delta to the wallet, floors at 0, writes the ledger row.
// Creates the wallet row if this is somehow the user's first-ever wallet
// touch (shouldn't normally happen — you need PROBLEMS to open a session
// in the first place — but keeps this route safe standalone).
async function applyWalletDelta(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  wallet: Wallet,
  delta: number,
  reason: string
): Promise<number> {
  const newBalance = Math.max(0, wallet.balance + delta);
  const actualDelta = newBalance - wallet.balance;

  await supabase.from("terminal_wallets").upsert({
    user_id: userId,
    balance: newBalance,
    lifetime_earned: wallet.lifetime_earned + Math.max(0, actualDelta),
    lifetime_spent: wallet.lifetime_spent + Math.max(0, -actualDelta),
  });

  if (actualDelta !== 0) {
    await supabase.from("terminal_token_ledger").insert({
      user_id: userId,
      delta: actualDelta,
      reason,
    });
  }

  return newBalance;
}

async function closeSession(
  supabase: ReturnType<typeof getServiceClient>,
  userId: string,
  sessionId: string,
  costPaid: number,
  wallet: Wallet
) {
  const { data: rows } = await supabase
    .from("terminal_undervoice_messages")
    .select("role, mood")
    .eq("session_id", sessionId);

  const tags: Mood[] = (rows ?? [])
    .filter((r) => r.role === "terminal" && r.mood)
    .map((r) => r.mood as Mood);

  const { outcome, delta } = resolveUndervoiceOutcome(tags, costPaid);
  const reason =
    outcome === "refund"
      ? "undervoice_refund"
      : outcome === "bonus"
        ? "undervoice_bonus"
        : outcome === "charge"
          ? "undervoice_extra_charge"
          : null;

  const newBalance = reason
    ? await applyWalletDelta(supabase, userId, wallet, delta, reason)
    : wallet.balance;

  await supabase
    .from("terminal_undervoice_sessions")
    .update({ status: "closed", outcome, outcome_delta: delta, closed_at: new Date().toISOString() })
    .eq("id", sessionId);

  return { outcome, delta, balance: newBalance };
}

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { supabase, userId } = auth;

  const [{ data: config }, { data: session }] = await Promise.all([
    supabase
      .from("terminal_config")
      .select("undervoice_paused, undervoice_session_cost, undervoice_max_messages")
      .single(),
    supabase
      .from("terminal_undervoice_sessions")
      .select("id, cost_paid, message_count, status")
      .eq("user_id", userId)
      .eq("status", "open")
      .maybeSingle(),
  ]);

  const wallet = await loadWallet(supabase, userId);

  let messages: { role: string; content: string; created_at: string }[] = [];
  if (session) {
    const { data: rows } = await supabase
      .from("terminal_undervoice_messages")
      .select("role, content, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });
    messages = rows ?? [];
  }

  return NextResponse.json({
    session: session
      ? {
          id: session.id,
          costPaid: session.cost_paid,
          messageCount: session.message_count,
        }
      : null,
    messages,
    wallet: { balance: wallet.balance },
    config: {
      paused: config?.undervoice_paused ?? false,
      sessionCost: config?.undervoice_session_cost ?? 5,
      maxMessages: config?.undervoice_max_messages ?? 8,
    },
  });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { supabase, userId } = auth;

  let body: { action?: string; sessionId?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { data: config } = await supabase
    .from("terminal_config")
    .select("undervoice_paused, undervoice_session_cost, undervoice_max_messages")
    .single();

  if (config?.undervoice_paused) {
    return NextResponse.json(
      { reply: "[signal lost]\nnothing is answering down here right now", paused: true },
      { status: 200 }
    );
  }

  const sessionCost = config?.undervoice_session_cost ?? 5;
  const maxMessages = config?.undervoice_max_messages ?? 8;

  if (body.action === "open") {
    const { data: existing } = await supabase
      .from("terminal_undervoice_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "open")
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "a session is already open" }, { status: 400 });
    }

    const wallet = await loadWallet(supabase, userId);
    if (wallet.balance < sessionCost) {
      return NextResponse.json(
        { error: `not enough PROBLEMS — need ${sessionCost}, have ${wallet.balance}` },
        { status: 400 }
      );
    }

    const newBalance = await applyWalletDelta(
      supabase,
      userId,
      wallet,
      -sessionCost,
      "undervoice_spend"
    );

    const { data: session, error: insertError } = await supabase
      .from("terminal_undervoice_sessions")
      .insert({ user_id: userId, cost_paid: sessionCost })
      .select("id, cost_paid, message_count")
      .single();

    if (insertError || !session) {
      // Refund immediately if the session row failed to create — the spend
      // already happened, don't leave a user's PROBLEMS stranded.
      await applyWalletDelta(supabase, userId, { ...wallet, balance: newBalance }, sessionCost, "undervoice_refund");
      return NextResponse.json({ error: "could not open a session" }, { status: 500 });
    }

    return NextResponse.json({
      session: { id: session.id, costPaid: session.cost_paid, messageCount: session.message_count },
      wallet: { balance: newBalance },
      maxMessages,
    });
  }

  if (body.action === "message") {
    const sessionId = body.sessionId;
    const message = (body.message ?? "").trim();
    if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });
    if (!message) return NextResponse.json({ error: "empty message" }, { status: 400 });
    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `keep it under ${MAX_MESSAGE_LENGTH} characters` },
        { status: 400 }
      );
    }

    const { data: session } = await supabase
      .from("terminal_undervoice_sessions")
      .select("id, user_id, status, cost_paid, message_count")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.user_id !== userId || session.status !== "open") {
      return NextResponse.json({ error: "no open session" }, { status: 400 });
    }
    if (session.message_count >= maxMessages) {
      return NextResponse.json({ error: "session is already at its limit" }, { status: 400 });
    }

    const { data: history } = await supabase
      .from("terminal_undervoice_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    const lastMessage = (history ?? [])[((history ?? []).length ?? 1) - 1];
    if (lastMessage) {
      const elapsed = Date.now() - new Date(lastMessage.created_at).getTime();
      if (elapsed < COOLDOWN_MS) {
        return NextResponse.json(
          { error: "the undervoice is still processing. try again in a moment" },
          { status: 429 }
        );
      }
    }

    const chatHistory: ChatMessage[] = (history ?? []).map((r) => ({
      role: r.role === "terminal" ? "assistant" : "user",
      content: r.content as string,
    }));
    chatHistory.push({ role: "user", content: message });

    let generated: Awaited<ReturnType<typeof generateUndervoiceReply>>;
    try {
      generated = await generateUndervoiceReply(chatHistory);
    } catch (err) {
      return NextResponse.json(
        { error: `the undervoice glitched: ${(err as Error).message}` },
        { status: 500 }
      );
    }

    const estimatedCostUsd = estimateCostUsd(generated.usage, "claude-sonnet-5");

    await supabase.from("terminal_undervoice_messages").insert([
      { session_id: sessionId, role: "user", content: message },
      {
        session_id: sessionId,
        role: "terminal",
        content: generated.content,
        mood: generated.mood,
        input_tokens: generated.usage.input_tokens,
        output_tokens: generated.usage.output_tokens,
        cache_creation_input_tokens: generated.usage.cache_creation_input_tokens,
        cache_read_input_tokens: generated.usage.cache_read_input_tokens,
        estimated_cost_usd: estimatedCostUsd,
      },
    ]);

    const newMessageCount = session.message_count + 1;
    await supabase
      .from("terminal_undervoice_sessions")
      .update({ message_count: newMessageCount })
      .eq("id", sessionId);

    if (newMessageCount >= maxMessages) {
      const wallet = await loadWallet(supabase, userId);
      const resolved = await closeSession(supabase, userId, sessionId, session.cost_paid, wallet);
      return NextResponse.json({
        reply: generated.content,
        session: { id: sessionId, status: "closed", messageCount: newMessageCount },
        outcome: { outcome: resolved.outcome, delta: resolved.delta },
        wallet: { balance: resolved.balance },
      });
    }

    return NextResponse.json({
      reply: generated.content,
      session: { id: sessionId, status: "open", messageCount: newMessageCount },
    });
  }

  if (body.action === "close") {
    const sessionId = body.sessionId;
    if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });

    const { data: session } = await supabase
      .from("terminal_undervoice_sessions")
      .select("id, user_id, status, cost_paid")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session || session.user_id !== userId || session.status !== "open") {
      return NextResponse.json({ error: "no open session" }, { status: 400 });
    }

    const wallet = await loadWallet(supabase, userId);
    const resolved = await closeSession(supabase, userId, sessionId, session.cost_paid, wallet);

    return NextResponse.json({
      session: { id: sessionId, status: "closed" },
      outcome: { outcome: resolved.outcome, delta: resolved.delta },
      wallet: { balance: resolved.balance },
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
