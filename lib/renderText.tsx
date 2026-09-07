import type { ReactNode } from "react";

// The persona writes one short thought per line ("line breaks as your only
// punctuation" — see SYSTEM_PROMPT/CHAT_SYSTEM_PROMPT in persona.ts), never
// real multi-sentence paragraphs. But models habitually put a blank line
// between every line anyway, so naively rendering every \n from
// whitespace-pre-wrap produced uniform double-spacing throughout a message.
// There's no real paragraph tier to preserve here — collapse ALL line
// breaks (single or blank-line) to the same tight gap.
export function renderTightLines(content: string): ReactNode[] {
  return content
    .split(/\n+/)
    .filter((line) => line.trim().length > 0)
    .map((line, i, arr) => (
      <span key={i}>
        {line}
        {i < arr.length - 1 && <br />}
      </span>
    ));
}
