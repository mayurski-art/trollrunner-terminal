// claude-opus-5 pricing, per million tokens (USD). Update if pricing changes.
const INPUT_PER_MTOK = 5;
const OUTPUT_PER_MTOK = 25;
const CACHE_WRITE_PER_MTOK = INPUT_PER_MTOK * 1.25; // 5-minute TTL write premium
const CACHE_READ_PER_MTOK = INPUT_PER_MTOK * 0.1;

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// This is an ESTIMATE derived from token usage on each call, not a live pull
// from Anthropic's billing system (there is no public API for that). It's a
// running approximation against a starting balance you set yourself.
export function estimateCostUsd(usage: Usage): number {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  return (
    (input * INPUT_PER_MTOK +
      output * OUTPUT_PER_MTOK +
      cacheWrite * CACHE_WRITE_PER_MTOK +
      cacheRead * CACHE_READ_PER_MTOK) /
    1_000_000
  );
}
