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

// *italics*, which may wrap onto the next line (the lore is hard-wrapped) but
// never across a blank one. The opening * follows a space, a quote or a
// bracket and the closing one is followed by the same, so "F***" and a lone
// "* COMING SOON" stay as they are. Escaped \* inside the span is allowed.
const ITALIC = /(^|[\s("'“‘[—-])\*(?![\s*])((?:\\.|[^*\r\n\\]|\r?\n(?!\r?\n))+?)(?<!\s)\*(?=[\s).,!?;:"'”’\]—-]|$)/gm;

// Markdown escapes (\* and \_) show as the bare character.
const unescape = (s: string) => s.replace(/\\([*_])/g, "$1");

export function renderLoreLinks(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(ITALIC)) {
    const at = (m.index ?? 0) + m[1].length;
    if (at > last) out.push(...renderLinks(text.slice(last, at), () => key++));
    out.push(<em key={key++}>{renderLinks(m[2], () => key++)}</em>);
    last = (m.index ?? 0) + m[0].length;
  }
  if (last < text.length) out.push(...renderLinks(text.slice(last), () => key++));
  return out;
}

function renderLinks(text: string, nextKey: () => number): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const key = nextKey();
    const at = m.index ?? 0;
    if (at > last) out.push(unescape(text.slice(last, at)));
    const [whole, label, href, bare, section] = m;
    if (href) {
      out.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {label}
        </a>
      );
    } else if (bare) {
      out.push(
        <a key={key} href={bare} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          {bare}
        </a>
      );
    } else if (section) {
      out.push(
        <a key={key} href={`/archive?file=${section}`} className={LINK_CLASS}>
          {whole}
        </a>
      );
    }
    last = at + whole.length;
  }
  if (last < text.length) out.push(unescape(text.slice(last)));
  return out;
}

// For places that show lore as a short plain-text snippet (teasers, search
// results): keeps a link's label and drops its URL, and unwraps *italics*,
// so no raw markdown leaks.
export function stripLoreLinks(text: string): string {
  return unescape(
    text
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1")
      .replace(ITALIC, "$1$2")
  );
}
