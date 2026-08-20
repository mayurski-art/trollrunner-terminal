import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { allSectionTitles, getArchiveSectionText } from "@/lib/loreSections";
import { isSeeded, sectionDepth } from "@/lib/loreArchive";

export const runtime = "nodejs";

// The lore archive — docs/TERMINAL-V4-DESIGN.md §3. Every numbered section
// of docs/TROLL-LORE.md is a file a signed-in troublemaker recovers, either
// free (Path A, app/api/chat/route.ts's archiveUnlock hook) or by spending
// PROBLEMS here (Path B). Section bodies are never sent to a client that
// hasn't unlocked them — sealed rows in the manifest carry a title (or a
// redacted "??" for depth-2 sections) and nothing else.

async function authedUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase };
}

export async function GET(request: Request) {
  const auth = await authedUser(request);
  if (!auth) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const { userId, supabase } = auth;

  const [{ data: unlockRows, error: unlockError }, { data: wallet }, { data: config }] =
    await Promise.all([
      supabase
        .from("terminal_lore_unlocks")
        .select("section_number")
        .eq("user_id", userId),
      supabase
        .from("terminal_wallets")
        .select("balance")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("terminal_config")
        .select("archive_unlock_cost, archive_deep_unlock_cost")
        .single(),
    ]);

  if (unlockError) {
    return NextResponse.json({ error: unlockError.message }, { status: 500 });
  }

  const unlockedSet = new Set((unlockRows ?? []).map((r) => r.section_number as number));

  const files = allSectionTitles().map(({ number, title }) => {
    const depth = sectionDepth(number);
    const open = isSeeded(number) || unlockedSet.has(number);
    return {
      number,
      title: open || depth === 1 ? title : "??",
      depth,
      state: open ? ("open" as const) : ("sealed" as const),
      body: open ? getArchiveSectionText(number) : null,
      cost: open ? null : depth === 2 ? config?.archive_deep_unlock_cost ?? 3 : config?.archive_unlock_cost ?? 1,
    };
  });

  const recoveredCount = files.filter((f) => f.state === "open").length;

  return NextResponse.json({
    files,
    recoveredCount,
    totalCount: files.length,
    balance: wallet?.balance ?? 0,
  });
}

export async function POST(request: Request) {
  const auth = await authedUser(request);
  if (!auth) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const { userId, supabase } = auth;

  let body: { section?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const section = body.section;
  if (typeof section !== "number" || !Number.isInteger(section)) {
    return NextResponse.json({ error: "missing section" }, { status: 400 });
  }

  if (isSeeded(section)) {
    return NextResponse.json({ error: "this file is already open" }, { status: 400 });
  }
  const text = getArchiveSectionText(section);
  if (text === null) {
    return NextResponse.json({ error: "no such file" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("terminal_lore_unlocks")
    .select("section_number")
    .eq("user_id", userId)
    .eq("section_number", section)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "this file is already open" }, { status: 400 });
  }

  const [{ data: wallet }, { data: config }] = await Promise.all([
    supabase.from("terminal_wallets").select("balance, lifetime_spent").eq("user_id", userId).maybeSingle(),
    supabase
      .from("terminal_config")
      .select("archive_unlock_cost, archive_deep_unlock_cost")
      .single(),
  ]);

  const cost =
    sectionDepth(section) === 2
      ? config?.archive_deep_unlock_cost ?? 3
      : config?.archive_unlock_cost ?? 1;
  const balance = wallet?.balance ?? 0;
  if (balance < cost) {
    return NextResponse.json({ error: "not enough PROBLEMS" }, { status: 400 });
  }

  const { error: unlockError } = await supabase
    .from("terminal_lore_unlocks")
    .insert({ user_id: userId, section_number: section, source: "purchase" });
  if (unlockError) {
    // 23505 = unique_violation — a concurrent request already unlocked it.
    if (unlockError.code === "23505") {
      return NextResponse.json({ error: "this file is already open" }, { status: 400 });
    }
    return NextResponse.json({ error: unlockError.message }, { status: 500 });
  }

  const newBalance = balance - cost;
  const { data: persistedWallet, error: walletError } = await supabase
    .from("terminal_wallets")
    .update({ balance: newBalance, lifetime_spent: (wallet?.lifetime_spent ?? 0) + cost })
    .eq("user_id", userId)
    .select("balance")
    .single();
  if (walletError) {
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }

  const { error: ledgerError } = await supabase.from("terminal_token_ledger").insert({
    user_id: userId,
    delta: -cost,
    reason: "archive_unlock",
  });
  if (ledgerError) console.error("[archive] failed to write ledger entry:", ledgerError.message);

  const title = allSectionTitles().find((s) => s.number === section)?.title ?? "unknown file";

  return NextResponse.json({
    section,
    title,
    body: text,
    balance: persistedWallet.balance,
  });
}
