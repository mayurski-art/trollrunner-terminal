import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/admin";

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
};

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
        model: "groq/compound-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "." }],
      }),
    });

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

    return {
      ...base,
      reachable,
      quota: {
        requestsRemaining,
        requestsLimit,
        tokensRemaining,
        tokensLimit,
        resetRequests: h.get("x-ratelimit-reset-requests"),
      },
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
    note: "no quota exposed on free tier",
  };
  if (!base.configured) return { ...base, note: "no api key configured" };

  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
    });
    return { ...base, reachable: res.ok };
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
    note: "no quota exposed",
  };
  if (!base.configured) return { ...base, note: "no api key configured" };

  try {
    // Listing models is the cheapest authenticated call that proves the key
    // works without spending any generation quota at all.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
    );
    return { ...base, reachable: res.ok };
  } catch {
    return { ...base, reachable: false, note: "unreachable" };
  }
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const providers = await Promise.all([checkGroq(), checkOpenRouter(), checkGemini()]);
  return NextResponse.json({ providers });
}
