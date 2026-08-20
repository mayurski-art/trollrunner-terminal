import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";

// Owner-only: powers the [ transmit ] page — the manual X-posting flow.
//
// X gates POST /2/tweets behind a paid developer tier, so this app has never
// auto-posted (lib/x.ts is dead code kept for if that ever changes). Until
// then the loop is: the cron writes a transmission, the owner opens it on an
// x.com/intent/post link, posts it by hand, and pastes the resulting status
// URL back here so terminal_posts.x_post_url finally gets set and the public
// "view on x" link stops being dead.
//
// terminal_posts has RLS enabled with no policies (migration 010), so every
// read here goes through the service-role client requireOwner() hands back.

const X_STATUS_RE =
  /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d{5,25})/i;

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_posts")
    .select("id, content, clue_tag, x_post_url, art_url, posted_at")
    .is("error", null)
    .order("posted_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posts = data ?? [];
  return NextResponse.json({
    posts,
    untransmitted: posts.filter((p) => !p.x_post_url).length,
  });
}

// Two owner actions, both plain column writes on one transmission:
//   mark_posted — record the x.com status URL after posting by hand
//   set_art     — record the art_url after generating the image by hand
// Both accept null to undo a mistake (a typo'd URL shouldn't be permanent).
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let body: { action?: string; id?: string; url?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed request" }, { status: 400 });
  }

  const { action, id } = body;
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "missing transmission id" }, { status: 400 });
  }

  const raw = typeof body.url === "string" ? body.url.trim() : null;
  const url = raw === "" ? null : raw;

  let column: "x_post_url" | "art_url";
  let value = url;

  if (action === "mark_posted") {
    column = "x_post_url";
    // Normalize twitter.com -> x.com and strip tracking params, so the
    // stored link is canonical no matter what the share sheet produced.
    if (url !== null) {
      const match = url.match(X_STATUS_RE);
      if (!match) {
        return NextResponse.json(
          { error: "that doesn't look like an x.com status url" },
          { status: 400 }
        );
      }
      const handle = url.split("/")[3];
      value = `https://x.com/${handle}/status/${match[1]}`;
    }
  } else if (action === "set_art") {
    column = "art_url";
    if (url !== null && !/^https:\/\//i.test(url)) {
      return NextResponse.json(
        { error: "art url must be https" },
        { status: 400 }
      );
    }
  } else {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  const { data, error } = await owner.supabase
    .from("terminal_posts")
    .update({ [column]: value })
    .eq("id", id)
    .select("id, content, clue_tag, x_post_url, art_url, posted_at")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "no such transmission" }, { status: 404 });
  }

  return NextResponse.json({ post: data });
}
