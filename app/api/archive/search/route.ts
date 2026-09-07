import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { allSectionTitles, getArchiveSectionText } from "@/lib/loreSections";
import { isSeeded } from "@/lib/loreArchive";
import { generateFreeReply } from "@/lib/freeProviders";

export const runtime = "nodejs";

// Search over the archive — but only ever over files the requesting user has
// actually unlocked. Sealed section bodies (and depth-2 titles) must never
// reach this route's response, same privacy invariant as GET /api/archive.
//
// Two layers: a plain substring/keyword match always runs (instant, free,
// zero network calls) and is what the client shows immediately as the user
// types. On top of that, this route optionally asks a free-tier provider
// (lib/freeProviders.ts — Groq/Gemini/OpenRouter round-robin, same as chat)
// to re-rank the keyword hits and write one short in-voice reason each is
// relevant. Paid Claude is never used here, per lib/persona.ts's image-only
// rule — if every free provider fails, the response just carries the plain
// keyword results with no `reason` field, and the client shows those alone.

async function authedUser(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, supabase };
}

type SearchHit = { number: number; title: string; snippet: string; reason: string | null };

const MAX_HITS = 6;
const SNIPPET_RADIUS = 80;

function buildSnippet(body: string, query: string): string {
  const idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return body.slice(0, SNIPPET_RADIUS * 2).trim() + "…";
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(body.length, idx + query.length + SNIPPET_RADIUS);
  return (start > 0 ? "…" : "") + body.slice(start, end).trim() + (end < body.length ? "…" : "");
}

export async function POST(request: Request) {
  const auth = await authedUser(request);
  if (!auth) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }
  const { userId, supabase } = auth;

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }
  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ hits: [], suggestions: [] });
  }

  const { data: unlockRows } = await supabase
    .from("terminal_lore_unlocks")
    .select("section_number")
    .eq("user_id", userId);
  const unlockedSet = new Set((unlockRows ?? []).map((r) => r.section_number as number));

  // Only sections this user can actually read — seeded-open ones plus
  // whatever they've unlocked. Sealed sections are invisible to search.
  const readable = allSectionTitles()
    .filter((s) => isSeeded(s.number) || unlockedSet.has(s.number))
    .map((s) => ({ ...s, body: getArchiveSectionText(s.number) ?? "" }));

  const q = query.toLowerCase();
  const keywordHits: SearchHit[] = readable
    .filter((s) => s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q))
    .slice(0, MAX_HITS)
    .map((s) => ({ number: s.number, title: s.title, snippet: buildSnippet(s.body, query), reason: null }));

  if (readable.length === 0) {
    return NextResponse.json({ hits: [], suggestions: [] });
  }

  // Free-tier re-rank + one-line "why this matches" pass, in voice. Best
  // effort only — a failure or malformed reply here just means the plain
  // keyword hits above are returned with no `reason` text, never an error.
  let suggestions: SearchHit[] = keywordHits;
  try {
    const catalog = readable
      .map((s) => `#${s.number} "${s.title}" — ${s.body.slice(0, 220).replace(/\s+/g, " ")}`)
      .join("\n");

    const system =
      "You are Trollface Terminal's memory index. Given a troublemaker's search query and a list of " +
      "recovered lore files (id, title, excerpt), pick up to 4 files that actually relate to the query. " +
      "Respond with ONLY plain lines, one per pick, in this exact format and nothing else:\n" +
      "#<number> | <one short in-voice reason it matches, under 12 words, no punctuation at the end>\n" +
      "If nothing genuinely relates, respond with exactly: NONE";

    const freeResult = await generateFreeReply(
      system,
      [{ role: "user", content: `Query: ${query}\n\nFiles:\n${catalog}` }],
      query.length,
      300
    );

    if (freeResult) {
      const picked = new Map<number, string>();
      for (const line of freeResult.content.split("\n")) {
        const m = line.match(/^#?(\d+)\s*\|\s*(.+)$/);
        if (m) picked.set(Number(m[1]), m[2].trim().slice(0, 80));
      }
      if (picked.size > 0) {
        suggestions = [...picked.entries()]
          .map((entry): SearchHit | null => {
            const [number, reason] = entry;
            const section = readable.find((s) => s.number === number);
            if (!section) return null;
            return { number, title: section.title, snippet: buildSnippet(section.body, query), reason };
          })
          .filter((h): h is SearchHit => h !== null)
          .slice(0, MAX_HITS);
      }
    }
  } catch (err) {
    console.error("[archive/search] free-provider ranking failed:", (err as Error).message);
  }

  return NextResponse.json({ hits: keywordHits, suggestions });
}
