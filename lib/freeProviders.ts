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

const MAX_OUTPUT_TOKENS = 300;

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
      model: "llama-3.3-70b-versatile",
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
      // OpenRouter's free-tier models rotate; this one is a stable free
      // alias as of this writing. Check openrouter.ai/models?max_price=0
      // if it stops responding — free-tier model ids do get retired.
      model: "meta-llama/llama-3.3-70b-instruct:free",
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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
