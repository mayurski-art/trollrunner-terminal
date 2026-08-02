// Per-million-token pricing (USD) by model. Update if pricing changes.
const RATES = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 }, // intro pricing through 2026-08-31
} as const;

export type PricedModel = keyof typeof RATES;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// This is an ESTIMATE derived from token usage on each call, not a live pull
// from Anthropic's billing system (there is no public API for that). It's a
// running approximation against a starting balance you set yourself.
export function estimateCostUsd(usage: Usage, model: PricedModel = "claude-opus-5"): number {
  const rate = RATES[model];
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWriteRate = rate.input * 1.25; // 5-minute TTL write premium
  const cacheReadRate = rate.input * 0.1;

  return (
    (input * rate.input +
      output * rate.output +
      cacheWrite * cacheWriteRate +
      cacheRead * cacheReadRate) /
    1_000_000
  );
}
