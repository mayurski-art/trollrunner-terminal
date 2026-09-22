import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";
import {
  GROQ_MODEL,
  OPENROUTER_MODEL,
  GEMINI_MODEL,
  MISTRAL_MODEL,
  parseRetryAfterSeconds,
} from "@/lib/freeProviders";

export const runtime = "nodejs";

// Owner-only: what's left on the free-tier providers that now write the
// transmissions and most chat replies (see lib/freeProviders.ts).
//
// Only Groq actually reports a quota. Verified 2026-09-02 against all three:
//   groq       — x-ratelimit-* headers: requests + tokens remaining, and a
//                reset clock. Real numbers, safe to draw a bar from.
//   openrouter — /api/v1/key returns is_free_tier true but limit and
//                limit_remaining are both null; free models are capped
//                per-model per-day and that isn't exposed on the key.
//   gemini     — exposes no quota headers at all.
//
// So this deliberately returns a mixed shape rather than three fake bars: a
// real quota for groq, and reachable/unreachable for the other two. A meter
// that invented numbers for two of three providers would be worse than none.
//
// IMPORTANT (2026-09-21): `reachable` must come from an actual generation
// call on the SAME model id the rotation uses. This page used to check
// openrouter by fetching /api/v1/key and gemini by listing models — both of
// which answer 200 on a spent key, because neither endpoint consumes or
// reports generation quota. It therefore showed all three providers green on
// a day when every one of them was failing to produce text, and the terminal
// was answering "the signal is gone" to every message. A health check that
// can't go red is worse than no health check.

type ProviderStatus = {
  name: string;
  configured: boolean;
  reachable: boolean | null;
  // Only ever populated for providers that genuinely report a quota.
  quota: {
    requestsRemaining: number;
    requestsLimit: number;
    tokensRemaining: number;
    tokensLimit: number;
    resetRequests: string | null;
  } | null;
  note: string;
  // The model id actually probed, so the meter can show WHICH model is
  // failing — a dead slug and a spent quota look identical without it.
  model?: string;
  // True when the model id itself is gone (404). Distinct from a 429: no
  // amount of waiting fixes it, someone has to re-pick the slug.
  deadSlug?: boolean;
  // Seconds until this provider is worth trying again — parsed from the
  // same Retry-After header / "try again in Xs" body text the rotation
  // itself uses to decide when to stop waiting (see WireDownError). Only
  // ever set on a 429/503; a dead slug (404) has no countdown because
  // nothing about waiting fixes it. This is what lets the page show
  // "resets in 8m38s" instead of a flat "down" for every provider, not
  // just the one (groq) that happens to expose real rate-limit headers.
  retryAfterSeconds?: number | null;
};

// Groq's x-ratelimit-reset-requests header is a duration string like
// "8m38.4s" or "850ms", not a timestamp. Parses the pieces it actually uses
// (h/m/s, with fractional seconds) into a plain second count so it can be
// treated the same as every other provider's retryAfterSeconds.
function parseGroqDuration(raw: string | null): number | null {
  if (!raw) return null;
  const m = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?(?:(\d+)ms)?$/);
  if (!m) return null;
  const hours = Number(m[1] ?? 0);
  const mins = Number(m[2] ?? 0);
  const secs = Number(m[3] ?? 0);
  const ms = Number(m[4] ?? 0);
  const total = hours * 3600 + mins * 60 + secs + ms / 1000;
  return Number.isFinite(total) && total > 0 ? Math.ceil(total) : null;
}

// Turns a failed generation into the note the owner actually needs to read.
function describeFailure(
  status: number,
  body: string,
  retryAfterSeconds: number | null
): { note: string; deadSlug: boolean } {
  if (status === 404) {
    return { note: "DEAD MODEL SLUG — re-pick it in lib/freeProviders.ts", deadSlug: true };
  }
  if (status === 429) {
    const perDay = /per-?day|free-models-per-day|PerDay/i.test(body);
    const note =
      retryAfterSeconds !== null
        ? perDay
          ? "daily quota exhausted"
          : "rate limited"
        : perDay
          ? "daily free quota exhausted — resets tomorrow"
          : "rate limited right now";
    return { note, deadSlug: false };
  }
  if (status === 503) return { note: "provider overloaded (503)", deadSlug: false };
  return { note: `generation failed (${status})`, deadSlug: false };
}

// 1 token out — just enough for the provider to answer with its rate-limit
// headers, so checking the meter never meaningfully eats the quota it
// reports on.
async function checkGroq(): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    name: "groq",
    configured: !!process.env.GROQ_API_KEY,
    reachable: null,
    quota: null,
    note: "reports real quota",
    model: GROQ_MODEL,
  };
  if (!base.configured) return { ...base, note: "no api key configured" };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });

    // A 404 here means the slug is gone — the single failure mode that has
    // silently removed a provider from the rotation more than once.
    if (res.status === 404) {
      const { note, deadSlug } = describeFailure(404, await res.text(), null);
      return { ...base, reachable: false, note, deadSlug, retryAfterSeconds: null };
    }

    const h = res.headers;
    const num = (key: string) => {
      const raw = h.get(key);
      const parsed = raw === null ? NaN : Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const requestsRemaining = num("x-ratelimit-remaining-requests");
    const requestsLimit = num("x-ratelimit-limit-requests");
    const tokensRemaining = num("x-ratelimit-remaining-tokens");
    const tokensLimit = num("x-ratelimit-limit-tokens");

    // 429 still carries the headers, and still means "configured and
    // answering" — just exhausted for the moment.
    const reachable = res.ok || res.status === 429;
    if (
      requestsRemaining === null ||
      requestsLimit === null ||
      tokensRemaining === null ||
      tokensLimit === null
    ) {
      return { ...base, reachable, note: "answered without quota headers" };
    }

    const resetRequests = h.get("x-ratelimit-reset-requests");
    return {
      ...base,
      reachable,
      quota: {
        requestsRemaining,
        requestsLimit,
        tokensRemaining,
        tokensLimit,
        resetRequests,
      },
      // Groq spells the reset as a duration string ("8m38.4s"), which is a
      // snapshot frozen at fetch time — rendered as plain text it silently
      // goes stale the moment the page sits open for a minute. Parsed into
      // seconds here so the frontend can convert it to an absolute deadline
      // once and tick a REAL countdown from `now`, same as every other
      // provider's retryAfterSeconds.
      retryAfterSeconds: parseGroqDuration(resetRequests),
    };
  } catch {
    return { ...base, reachable: false, note: "unreachable" };
  }
}

async function checkOpenRouter(): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    name: "openrouter",
    configured: !!process.env.OPENROUTER_API_KEY,
    reachable: null,
    quota: null,
    note: "answering generations",
    model: OPENROUTER_MODEL,
  };
  if (!base.configured) return { ...base, note: "no api key configured" };

  try {
    // Deliberately a real 1-token generation, not GET /api/v1/key. The key
    // endpoint returns 200 on a completely spent free tier, which is how
    // this page showed openrouter green while every chat reply was static.
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });
    if (res.ok) return { ...base, reachable: true };
    const body = await res.text();
    const retryAfterSeconds = parseRetryAfterSeconds(res, body);
    const { note, deadSlug } = describeFailure(res.status, body, retryAfterSeconds);
    return { ...base, reachable: false, note, deadSlug, retryAfterSeconds };
  } catch {
    return { ...base, reachable: false, note: "unreachable" };
  }
}

async function checkGemini(): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    name: "gemini",
    configured: !!process.env.GEMINI_API_KEY,
    reachable: null,
    quota: null,
    note: "answering generations",
    model: GEMINI_MODEL,
  };
  if (!base.configured) return { ...base, note: "no api key configured" };

  try {
    // Deliberately a real 1-token generation, not GET /v1beta/models.
    // Listing models is free and therefore answers 200 even when the daily
    // generation quota is completely spent — the free tier on the full flash
    // models is only 20 requests/day, so that gap is the normal case, not an
    // edge case, and it made this page report gemini healthy all day.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "." }] }],
          generationConfig: { maxOutputTokens: 1 },
        }),
      }
    );
    if (res.ok) return { ...base, reachable: true };
    const body = await res.text();
    const retryAfterSeconds = parseRetryAfterSeconds(res, body);
    const { note, deadSlug } = describeFailure(res.status, body, retryAfterSeconds);
    return { ...base, reachable: false, note, deadSlug, retryAfterSeconds };
  } catch {
    return { ...base, reachable: false, note: "unreachable" };
  }
}

async function checkMistral(): Promise<ProviderStatus> {
  const base: ProviderStatus = {
    name: "mistral",
    configured: !!process.env.MISTRAL_API_KEY,
    reachable: null,
    quota: null,
    note: "answering generations",
    model: MISTRAL_MODEL,
  };
  if (!base.configured) return { ...base, note: "no api key configured" };

  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });
    if (res.ok) return { ...base, reachable: true };
    const body = await res.text();
    const retryAfterSeconds = parseRetryAfterSeconds(res, body);
    const { note, deadSlug } = describeFailure(res.status, body, retryAfterSeconds);
    return { ...base, reachable: false, note, deadSlug, retryAfterSeconds };
  } catch {
    return { ...base, reachable: false, note: "unreachable" };
  }
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const providers = await Promise.all([
    checkGroq(),
    checkOpenRouter(),
    checkGemini(),
    checkMistral(),
  ]);
  return NextResponse.json({ providers });
}
