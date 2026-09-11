import type { ReactNode } from "react";

// A line that's nothing but the broadcast persona's old musing/clue mark
// (see lib/persona.ts) is a leftover signature glyph from transmissions
// posted before that mark was retired — it carries no content, so it's
// dropped entirely rather than rendered (previously shown small).
const MARK_ONLY_LINE = /^[▚▞▓▒\s]+$/;

// The persona writes short, casual prose (see SYSTEM_PROMPT/CHAT_SYSTEM_PROMPT
// in persona.ts) and older transmissions wrote one short thought per line —
// either way, never long multi-paragraph bodies. Models habitually put a blank
// line between every line anyway, so a single \n and a blank-line \n\n get treated the
// same tight way (just <br>) — that's what stops uniform double-spacing
// from showing up throughout a message. A deliberate blank line separating
// real stanzas (two or more blank lines together) is rare enough from a
// model, and common enough from a hand-typed transmission, to read as an
// actual paragraph break instead — that one case gets real spacing.
export function renderTightLines(content: string, singleSpaced = false): ReactNode[] {
  const paragraphs = content.split(/\n\s*\n+/);

  return paragraphs.flatMap((para, pi) => {
    const lines = para
      .split(/\n+/)
      .filter((line) => line.trim().length > 0 && !MARK_ONLY_LINE.test(line));
    if (lines.length === 0) return [];
    const nodes = lines.map((line, i) => (
      <span key={`${pi}-${i}`}>
        {line}
        {i < lines.length - 1 && <br />}
      </span>
    ));
    if (pi >= paragraphs.length - 1) return nodes;
    // The logs archive (and its pop-out) render every transmission back to
    // back in a dense list/grid — the real-paragraph double-<br> gap reads
    // as too loose there, so callers can ask for a single <br> instead.
    return singleSpaced ? [...nodes, <br key={`${pi}-gap1`} />] : [...nodes, <br key={`${pi}-gap1`} />, <br key={`${pi}-gap2`} />];
  });
}
