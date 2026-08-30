import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";

// Owner-only kill switch for chat, same requireOwner() gate as
// /api/admin/credits. GET reads current state (for the button's initial
// render); POST flips it. Chat's own read of chat_paused (app/api/chat/
// route.ts) already short-circuits every request the instant this is on,
// so flipping it takes effect on the very next message sent anywhere.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_config")
    .select("chat_paused")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paused: !!data?.chat_paused });
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let body: { paused?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ error: "paused must be a boolean" }, { status: 400 });
  }

  const { error } = await owner.supabase
    .from("terminal_config")
    .update({ chat_paused: body.paused })
    .eq("id", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ paused: body.paused });
}
