"use client";

import { useCallback, useEffect, useState } from "react";
import NewestFile from "@/components/NewestFile";

// The screen /archive opens on: the restricted stacks art
// (/assets/archive-stacks-*.jpg, .archive-entrance-art in globals.css)
// behind the front page's NEW FILE box (only while there is a new file) and
// a few lines that type themselves out. It stays until the reader enters:
// space, enter, a click or a tap. A click on the NEW FILE box opens its
// popup instead, and the entrance waits behind it. The instructions tab is
// hidden while this is up (html[data-archive-entrance] in globals.css).
// Plays on every arrival, a click on [archive] or a full load/refresh of
// /archive (the site-wide boot sequence skips /archive for this). It is in
// the server HTML and opaque from its first frame, so the archive page
// never shows before it.

type Line = { text: string; tail?: string; tone?: "alert" };

const LINES: Line[] = [
  { text: "> requesting clearance......", tail: "granted" },
  { text: "> ascending in trolling intellect" },
  { text: "> error in retrieving files...", tail: "just trolling", tone: "alert" },
  { text: "> read all you want, we never close" },
];

const LINE_MS = 430;
const FADE_MS = 450;

export default function ArchiveEntrance() {
  const [phase, setPhase] = useState<"in" | "out" | "gone">("in");
  const [shown, setShown] = useState(0);
  // True while the NEW FILE popup is open: the entrance stays up behind it
  // (unmounting would take the popup with it) and ignores keys and clicks.
  const [holding, setHolding] = useState(false);

  const enter = useCallback(() => {
    setPhase("out");
    setTimeout(() => setPhase("gone"), FADE_MS);
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(LINES.length);
      return;
    }
    const timers = LINES.map((_, i) => setTimeout(() => setShown(i + 1), 250 + i * LINE_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (phase === "gone") return;
    const root = document.documentElement;
    root.setAttribute("data-archive-entrance", "");
    return () => root.removeAttribute("data-archive-entrance");
  }, [phase]);

  useEffect(() => {
    if (phase !== "in" || holding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        enter();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, holding, enter]);

  if (phase === "gone") return null;

  return (
    <div
      role="presentation"
      onClick={() => {
        if (!holding) enter();
      }}
      className={`archive-entrance fixed inset-0 z-50 flex items-start justify-center pt-[15vh] cursor-pointer ${
        phase === "out" ? "archive-entrance-out" : ""
      }`}
    >
      <div className="archive-entrance-art" aria-hidden="true" />

      {/* Everything inside is sized in em off .archive-entrance-content's
          screen-scaled font-size (globals.css), so the lines, the prompt
          and the NEW FILE box grow and shrink together on every screen. */}
      <div className="archive-entrance-content relative w-full [text-shadow:0_1px_2px_var(--background),0_0_6px_var(--background)]">
        {/* Clicks here open the popup instead of entering the archive. */}
        <div className="archive-entrance-newfile mb-[1.4em]" onClick={(e) => e.stopPropagation()}>
          <NewestFile size="fluid" onPopupChange={setHolding} />
        </div>

        <div className="space-y-[0.45em] min-h-[7.3em]" aria-live="polite">
          {LINES.slice(0, shown).map((line, i) => (
            <p key={i} className={`archive-entrance-line ${line.tone === "alert" ? "text-alert" : "text-terminal"}`}>
              {line.text}
              {line.tail && (
                <span className={line.tone === "alert" ? "text-terminal" : "text-problem"}> {line.tail}</span>
              )}
            </p>
          ))}
          {shown < LINES.length && <span className="stacks-caret text-terminal">_</span>}
        </div>

        <p
          className={`archive-entrance-enter mt-[1.4em] text-terminal text-center tracking-widest uppercase ${
            shown < LINES.length ? "invisible" : ""
          }`}
        >
          <span className="archive-entrance-enter-mouse">[ press space or click to enter the archive ]</span>
          <span className="archive-entrance-enter-touch">[ tap to enter the archive ]</span>
        </p>
      </div>
    </div>
  );
}
