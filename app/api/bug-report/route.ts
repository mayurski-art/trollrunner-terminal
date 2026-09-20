import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

const MAX_LEN = 500;
const COOLDOWN_MS = 10 * 60 * 1000;

// In-memory, per-server-instance rate limit — good enough for a low-volume
// report queue, same trust model as the client-side localStorage cooldown
// PFP Studio's bug button uses (troll_pfp_bug_reports.sql / pfp-bug-reports.js
// in the main site repo). Keyed to IP rather than account so a signed-out
// troublemaker is still limited.
const lastSubmitByIp = new Map<string, number>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const message = String(body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "write what went wrong first" }, { status: 400 });
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `keep it under ${MAX_LEN} characters` }, { status: 400 });
  }

  const ip = clientIp(request);
  const last = lastSubmitByIp.get(ip);
  if (last && Date.now() - last < COOLDOWN_MS) {
    const remainingMs = COOLDOWN_MS - (Date.now() - last);
    const remainingSec = Math.ceil(remainingMs / 1000);
    const min = Math.floor(remainingSec / 60);
    const sec = remainingSec % 60;
    const remaining = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
    return NextResponse.json({ error: `you can send another report in ${remaining}` }, { status: 429 });
  }

  const supabase = getServiceClient();

  // Optional: attach the signed-in reporter if a session token is present,
  // same as PFP's bug button — but reporting a bug shouldn't require sign-in,
  // since plenty of bugs happen before/without login.
  let reporterId: string | null = null;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    reporterId = data.user?.id ?? null;
  }

  const { error } = await supabase.from("terminal_bug_reports").insert([
    {
      message,
      reporter_id: reporterId,
      user_agent: request.headers.get("user-agent"),
    },
  ]);

  if (error) {
    return NextResponse.json({ error: "could not send that — try again" }, { status: 500 });
  }

  lastSubmitByIp.set(ip, Date.now());
  return NextResponse.json({ ok: true });
}
