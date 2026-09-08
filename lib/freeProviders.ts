// Free-tier providers for all of the terminal's generated text — chat
// replies and transmissions alike. Paid Claude is reserved for image
// selection only (show_image; see lib/persona.ts) and is deliberately NOT a
// fallback here. Round-robin across these three so no single free tier's
// rate limit takes the terminal down, with the next provider in line tried
// on any failure. If a provider has no API key configured (see
// .env.example), it's skipped as if it were down.
//
// All three expose the same shape from here: an OpenAI-style chat message
// array in, plain reply text out. Callers should treat a null return as
// "every free provider is unavailable right now" and degrade gracefully —
// never by paying for Claude.

export type ChatTurn = { role: "user" | "assistant"; content: string };

type FreeProvider = {
  name: string;
  enabled: () => boolean;
  generate: (system: string, history: ChatTurn[], maxTokens: number, signal: AbortSignal) => Promise<string | null>;
};

// None of the three providers ever timed out on their own — a slow (not
// failing) response just sat there with no escape hatch, since the
// round-robin below only advances on a thrown error. Reported live as a
// chat reply stuck on "decoding..." far longer than the free tiers should
// ever take. groq/compound-mini in particular runs its own tool-calling
// loop server-side and can occasionally stall well past a normal chat
// reply's budget.
const PROVIDER_TIMEOUT_MS = 15_000;

// A transmission asks for MAX_OUTPUT_TOKENS_POST (2000) worth of budget, most
// of it spent on invisible reasoning before the first visible character — at
// the 15s chat timeout all three providers could abort mid-think and the
// whole generation failed with "no free provider produced a usable
// transmission." Give a post a longer per-provider window, bounded by an
// overall deadline so three slow providers can't run past the route's
// maxDuration (60s) and turn a recoverable failure into a dead request.
export const POST_TIMEOUT_MS = 24_000;
export const POST_DEADLINE_MS = 50_000;

// Generous relative to the terminal's actual "1-4 short lines" reply
// length — several of the current free-tier models are reasoning models
// that spend a chunk of this budget on invisible "thinking" before ever
// reaching the visible answer (see the per-provider notes below), so a
// tight budget was silently truncating replies to nothing.
const MAX_OUTPUT_TOKENS = 500;

// Transmissions need noticeably more than a chat reply: the post itself is
// only ~280 chars, but it has to be followed by the CLUE: line, and the
// reasoning models burn a large invisible budget before emitting either.
// At 500 both gemini and openrouter were verified truncating mid-"CLUE:",
// which silently produced an empty clue_tag on every post they wrote.
export const MAX_OUTPUT_TOKENS_POST = 2000;

// A rate-limited free tier usually says exactly how long to wait — groq puts
// it in the error body ("Please try again in 16.86s") and most providers set
// a Retry-After header. Carrying that number out of the provider call is what
// lets the UI show a real countdown instead of a dead error string.
// Written as a plain field rather than a TypeScript parameter property so the
// module still runs under node's strip-only type stripping — that's what lets
// a scratch script exercise real generations without a build step.
export class ProviderError extends Error {
  readonly retryAfterSeconds: number | null;

  constructor(message: string, retryAfterSeconds: number | null) {
    super(message);
    this.name = "ProviderError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function providerError(name: string, res: Response): Promise<ProviderError> {
  const body = await res.text();

  const header = res.headers.get("retry-after")?.trim();
  let retry: number | null = null;
  if (header && /^\d+(\.\d+)?$/.test(header)) {
    retry = Number(header);
  } else if (header) {
    // Retry-After may be an HTTP date rather than a delta.
    const at = Date.parse(header);
    if (!Number.isNaN(at)) retry = Math.max(0, Math.round((at - Date.now()) / 1000));
  }

  // groq's body carries the wait even when the header doesn't.
  if (retry === null) {
    const spelled = body.match(/try again in ([\d.]+)\s*(ms|s)\b/i);
    if (spelled) {
      const value = Number(spelled[1]);
      retry = spelled[2].toLowerCase() === "ms" ? value / 1000 : value;
    }
  }

  // A wait longer than a coffee break is almost always a daily/monthly quota
  // rather than a burst limit; clamp so the UI never shows an absurd timer.
  if (retry !== null) retry = Math.min(Math.ceil(retry), 15 * 60);

  return new ProviderError(`${name} ${res.status}: ${body}`, retry);
}

async function callGroq(
  system: string,
  history: ChatTurn[],
  maxTokens: number,
  signal: AbortSignal
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // groq/compound-mini — verified 2026-08-29 to return clean `content`
      // with an empty `reasoning` field. Groq's plain-instruct Llama models
      // (llama-3.3-70b-versatile) were retired from their catalog; most of
      // what's left (gpt-oss-*, qwen3.6-*) are reasoning models that either
      // eat the token budget on invisible thinking or (qwen) leak
      // "<think>...</think>" straight into content. Re-check
      // console.groq.com/docs/models if this one ever 404s.
      model: "groq/compound-mini",
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  if (!res.ok) throw await providerError("groq", res);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callOpenRouter(
  system: string,
  history: ChatTurn[],
  maxTokens: number,
  signal: AbortSignal
): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // OpenRouter's free-tier catalog rotates often and old slugs 404 — the
      // previous pick (minimax/minimax-m2.7:free) had silently gone paid-only
      // and was answering 404 "use the paid slug instead" on every single
      // call, so this provider had been dead weight in the rotation for a
      // while. Re-picked and voice-tested 2026-09-08 against the real post
      // prompt; it writes in voice, but its free pool is genuinely unreliable
      // (four back-to-back calls gave two empty responses, one timeout and
      // one clean transmission), which is what the retry pass in
      // generateFreeReply is there to absorb. Rejected while testing:
      // thinkingmachines/inkling:free (403, agentic harnesses only), both
      // google/gemma-4-*:free (429 upstream), dots-studio/dots-3-note-preview
      // (empty then timeout). nvidia/nemotron-3-super-120b-a12b:free responds
      // but completely ignores the voice instructions (generic "I'm an AI
      // assistant" chatbot, markdown bullets and all) — don't swap back to it.
      // Check openrouter.ai/api/v1/models for `:free` ids if this 404s, and
      // always verify a replacement's actual output against the persona's
      // voice rules, not just that it returns 200.
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      max_tokens: maxTokens,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  if (!res.ok) throw await providerError("openrouter", res);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(
  system: string,
  history: ChatTurn[],
  maxTokens: number,
  signal: AbortSignal
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    // gemini-2.0-flash was retired; gemini-3.6-flash is the current free-tier
    // equivalent as of 2026-08-29. Google deprecates model ids on a real
    // cadence — check ai.google.dev/gemini-api/docs/models if this 404s.
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    }
  );
  if (!res.ok) throw await providerError("gemini", res);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  return text?.trim() || null;
}

const PROVIDERS: FreeProvider[] = [
  { name: "groq", enabled: () => !!process.env.GROQ_API_KEY, generate: callGroq },
  { name: "gemini", enabled: () => !!process.env.GEMINI_API_KEY, generate: callGemini },
  { name: "openrouter", enabled: () => !!process.env.OPENROUTER_API_KEY, generate: callOpenRouter },
];

// validated: false means no provider satisfied `validate` and this is the
// best near-miss the rotation saw (see the `salvage` parameter). Callers that
// pass no validator never see it.
export type FreeReplyResult = { content: string; provider: string; validated: boolean } | null;

// Round-robin starting point is caller-supplied (the route passes in the
// day's running message count) rather than tracked here, since this module
// has no persistent state across serverless invocations — an in-memory
// counter would reset on every cold start and effectively always start at
// the same provider.
//
// validate lets a caller reject a 200 that came back malformed (see
// generatePost's CLUE-line check) so the round-robin moves on to the next
// free provider instead of the caller giving up and paying for Claude.
// salvage is the softer second opinion on a response `validate` rejected: if
// no provider produces a fully valid answer, the first rejected one that
// still passes salvage comes back with validated: false instead of the whole
// call failing. A transmission that came back in voice but without its CLUE
// line used to take the entire generation down (reported as "generation
// failed: no free provider produced a usable transmission" after a trash and
// regenerate); it's a perfectly good musing, so the caller gets the chance to
// keep it rather than the owner getting nothing.
export async function generateFreeReply(
  system: string,
  history: ChatTurn[],
  rotationSeed: number,
  maxTokens: number = MAX_OUTPUT_TOKENS,
  validate: (content: string) => boolean = () => true,
  options: {
    timeoutMs?: number;
    deadlineMs?: number;
    salvage?: (content: string) => boolean;
    passes?: number;
  } = {}
): Promise<FreeReplyResult> {
  const enabledProviders = PROVIDERS.filter((p) => p.enabled());
  if (enabledProviders.length === 0) return null;

  const { timeoutMs = PROVIDER_TIMEOUT_MS, deadlineMs, salvage, passes = 1 } = options;
  const deadline = deadlineMs ? Date.now() + deadlineMs : null;

  const startIndex = ((rotationSeed % enabledProviders.length) + enabledProviders.length) % enabledProviders.length;

  let salvaged: FreeReplyResult = null;

  // Waits the providers themselves asked for, collected so an exhausted
  // rotation can tell the caller when it's worth trying again — see
  // lastCooldownSeconds.
  const retryHints: number[] = [];

  // The free tiers fail transiently far more often than they fail hard —
  // measured live 2026-09-08, a single OpenRouter free model returned empty
  // content twice, timed out once and produced a clean post once across four
  // back-to-back calls, while Gemini answered 503 "high demand" and then
  // worked. One trip round the rotation therefore isn't much of a guarantee:
  // callers with time to spare (see POST_DEADLINE_MS) can ask for another,
  // which is the difference between a transmission and an error message.
  for (let i = 0; i < enabledProviders.length * Math.max(1, passes); i++) {
    const provider = enabledProviders[(startIndex + i) % enabledProviders.length];

    // Never start a provider that can't finish inside the overall budget —
    // better to fall back on what's already in hand than to be killed
    // mid-request by the platform's function timeout.
    const remaining = deadline ? deadline - Date.now() : Infinity;
    if (remaining < 3_000) {
      console.error(`[freeProviders] out of time before ${provider.name}`);
      break;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, remaining));
    try {
      const content = await provider.generate(system, history, maxTokens, controller.signal);
      if (content && validate(content)) return { content, provider: provider.name, validated: true };
      if (content && !salvaged && salvage?.(content)) {
        salvaged = { content, provider: provider.name, validated: false };
      }
      console.error(
        `[freeProviders] ${provider.name} returned ${content ? "an unusable response" : "no content"}`
      );
    } catch (err) {
      const label = (err as Error).name === "AbortError" ? "timed out" : (err as Error).message;
      if (err instanceof ProviderError && err.retryAfterSeconds !== null) {
        retryHints.push(err.retryAfterSeconds);
      }
      console.error(`[freeProviders] ${provider.name} failed:`, label);
    } finally {
      clearTimeout(timer);
    }
  }

  if (salvaged) {
    console.error(`[freeProviders] falling back to ${salvaged.provider}'s unvalidated response`);
    return salvaged;
  }

  // Nothing came back at all. Report how long to wait: the shortest window any
  // provider named, since the rotation only needs ONE of them back to work
  // again. If none said (a 503 "high demand", a timeout, an empty response)
  // fall back to a default that's long enough to be worth waiting out and
  // short enough not to feel like a ban.
  cooldownSeconds = retryHints.length > 0 ? Math.min(...retryHints) : DEFAULT_COOLDOWN_SECONDS;
  return null;
}

// How long the caller should wait after the most recent exhausted rotation.
// Deliberately module-level rather than part of the return type: every
// existing caller treats null as "degrade gracefully" and shouldn't have to
// change shape, and a serverless invocation handles one request, so there's
// no cross-request bleed to worry about. Read it immediately after a null.
const DEFAULT_COOLDOWN_SECONDS = 90;
let cooldownSeconds = DEFAULT_COOLDOWN_SECONDS;

export function lastCooldownSeconds(): number {
  return cooldownSeconds;
}