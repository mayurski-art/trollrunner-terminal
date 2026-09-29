import type { ReactNode } from "react";

// Archive files are TROLL-LORE.md sections rendered as plain text, so without
// this their sources showed up as raw "[label](https://...)" strings. This
// turns three things into real links:
//   [label](https://...)  → the label, opening that page in a new tab
//   a bare https://...    → the URL itself, same
//   §56                   → a jump to archive file 56 (same tab)
const TOKEN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()\]`]+[^\s<>()\]`.,;:!?'"])|§\s?(\d{1,3})\b/g;

const LINK_CLASS =
  "text-terminal underline decoration-dim underline-offset-4 hover:decoration-terminal break-words";

export function renderLoreLinks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const [whole, label, href, bare, section] = m;
    if (href) {
      out.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {label}
        </a>
      );
    } else if (bare) {
      out.push(
        <a key={key++} href={bare} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {bare}
        </a>
      );
    } else if (section) {
      out.push(
        <a key={key++} href={`/archive?file=${section}`} className={LINK_CLASS}>
          {whole}
        </a>
      );
    }
    last = at + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// For places that show lore as a short plain-text snippet (teasers, search
// results): keeps a link's label and drops its URL, so no raw markdown leaks.
export function stripLoreLinks(text: string): string {
  return text.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1");
}
