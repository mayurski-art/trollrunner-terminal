import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import { getRemainingUsd } from "@/lib/budget";

export const runtime = "nodejs";

// Owner-only: how much of the console.anthropic.com balance behind this app
// has been spent. This used to ride along on the public GET /api/posts
// response, which handed every anonymous visitor the project's spend
// figures — same requireOwner() gate as /api/admin/latest-clue now, so only
// troll_runner can read it.
export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  try {
    const usage = await getRemainingUsd(owner.supabase);
    return NextResponse.json({ usage });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
