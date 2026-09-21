import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";

// Free tweet lookup via fxtwitter's JSON API (no X API key needed) — see
// memory "fxtwitter-api-tweet-fetch-method". Used to auto-fill the trolldeaths
// admin form's title/copy/date/tags from a pasted x.com/twitter.com link.
function parseTweetUrl(raw: string): { handle: string; id: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)(x\.com|twitter\.com)$/i.test(url.hostname)) return null;
  const match = url.pathname.match(/^\/([^/]+)\/status\/(\d+)/);
  if (!match) return null;
  return { handle: match[1], id: match[2] };
}

function deriveTags(text: string): string[] {
  const tags = new Set<string>();
  const cashtags = text.match(/\$[A-Za-z]{2,10}/g) ?? [];
  for (const tag of cashtags) tags.add(tag.toUpperCase());
  const hashtags = text.match(/#[A-Za-z0-9_]{2,24}/g) ?? [];
  for (const tag of hashtags) tags.add(tag.replace(/^#/, "").toLowerCase());
  return Array.from(tags).slice(0, 8);
}

function deriveTitle(authorName: string, text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? text;
  const trimmed = firstLine.length > 100 ? `${firstLine.slice(0, 97)}...` : firstLine;
  return `${authorName}: ${trimmed}`;
}

export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "not authorized" }, { status: 403 });

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "malformed request" }, { status: 400 });
  }

  const parsed = parseTweetUrl(String(body.url ?? ""));
  if (!parsed) {
    return NextResponse.json({ error: "not a valid x.com/twitter.com status link" }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(`https://api.fxtwitter.com/${parsed.handle}/status/${parsed.id}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "could not reach the tweet lookup service" }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: `tweet lookup failed (${res.status}) — it may be deleted or protected` }, { status: 502 });
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return NextResponse.json({ error: "tweet lookup returned malformed data" }, { status: 502 });
  }

  const tweet = (data as { tweet?: Record<string, unknown> })?.tweet;
  if (!tweet || typeof tweet.text !== "string") {
    return NextResponse.json({ error: "tweet not found" }, { status: 404 });
  }

  const text = tweet.text as string;
  const author = tweet.author as { name?: string; screen_name?: string } | undefined;
  const authorName = author?.name || author?.screen_name || parsed.handle;
  const createdAt = typeof tweet.created_at === "string" ? tweet.created_at : undefined;
  const eventDate = createdAt ? new Date(createdAt) : new Date();

  return NextResponse.json({
    title: deriveTitle(authorName, text),
    copy: text,
    tags: deriveTags(text),
    eventDate: (Number.isNaN(eventDate.getTime()) ? new Date() : eventDate).toISOString(),
    sourceHref: `https://x.com/${parsed.handle}/status/${parsed.id}`,
    sourceLabel: `@${author?.screen_name ?? parsed.handle} on X`,
  });
}
