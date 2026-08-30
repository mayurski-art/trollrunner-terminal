// Free-tier chat providers for the terminal's reply text — Claude is still
// used for the two small, reliability-critical decisions (show_image,
// substance_read; see lib/persona.ts), but the bulk of spend was always the
// reply generation itself. Round-robin across these three so no single
// free tier's rate limit takes the terminal down, with the next provider
// in line tried on any failure. If a provider has no API key configured
// (see .env.example), it's skipped as if it were down.
//
// All three expose the same shape from here: an OpenAI-style chat message
// array in, plain reply text out. Callers should treat a null return as
// "every free provider is unavailable right now" and fall back to Claude
// for the reply too (see generateChatReply).

export type ChatTurn = { role: "user" | "assistant"; content: string };

type FreeProvider = {
  name: string;
  enabled: () => boolean;
  generate: (system: string, history: ChatTurn[]) => Promise<string | null>;
};

// Generous relative to the terminal's actual "1-4 short lines" reply
// length — several of the current free-tier models are reasoning models
// that spend a chunk of this budget on invisible "thinking" before ever
// reaching the visible answer (see the per-provider notes below), so a
// tight budget was silently truncating replies to nothing.
const MAX_OUTPUT_TOKENS = 500;

async function callGroq(system: string, history: ChatTurn[]): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
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
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  if (!res.ok) throw new Error(`groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callOpenRouter(system: string, history: ChatTurn[]): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // OpenRouter's free-tier catalog rotates often and old slugs 404 —
      // this one was verified working 2026-08-29 as the best persona-voice
      // match among the currently free models actually tested against this
      // system prompt. nvidia/nemotron-3-super-120b-a12b:free technically
      // works but completely ignores the voice instructions (answers as a
      // generic "I'm an AI assistant" chatbot, markdown bullets and all) —
      // don't swap back to it without re-testing against a real prompt.
      // Check openrouter.ai/models?max_price=0 if this 404s, and always
      // verify a replacement's actual output against CHAT_SYSTEM_PROMPT's
      // voice rules, not just that it returns 200.
      model: "minimax/minimax-m2.7:free",
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "system", content: system }, ...history],
    }),
  });
  if (!res.ok) throw new Error(`openrouter ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(system: string, history: ChatTurn[]): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch(
    // gemini-2.0-flash was retired; gemini-3.6-flash is the current free-tier
    // equivalent as of 2026-08-29. Google deprecates model ids on a real
    // cadence — check ai.google.dev/gemini-api/docs/models if this 404s.
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  return text?.trim() || null;
}

const PROVIDERS: FreeProvider[] = [
  { name: "groq", enabled: () => !!process.env.GROQ_API_KEY, generate: callGroq },
  { name: "gemini", enabled: () => !!process.env.GEMINI_API_KEY, generate: callGemini },
  { name: "openrouter", enabled: () => !!process.env.OPENROUTER_API_KEY, generate: callOpenRouter },
];

export type FreeReplyResult = { content: string; provider: string } | null;

// Round-robin starting point is caller-supplied (the route passes in the
// day's running message count) rather than tracked here, since this module
// has no persistent state across serverless invocations — an in-memory
// counter would reset on every cold start and effectively always start at
// the same provider.
export async function generateFreeReply(
  system: string,
  history: ChatTurn[],
  rotationSeed: number
): Promise<FreeReplyResult> {
  const enabledProviders = PROVIDERS.filter((p) => p.enabled());
  if (enabledProviders.length === 0) return null;

  const startIndex = ((rotationSeed % enabledProviders.length) + enabledProviders.length) % enabledProviders.length;

  for (let i = 0; i < enabledProviders.length; i++) {
    const provider = enabledProviders[(startIndex + i) % enabledProviders.length];
    try {
      const content = await provider.generate(system, history);
      if (content) return { content, provider: provider.name };
    } catch (err) {
      console.error(`[freeProviders] ${provider.name} failed:`, (err as Error).message);
    }
  }
  return null;
}
