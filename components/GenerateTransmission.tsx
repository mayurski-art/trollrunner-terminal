"use client";

import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";
import { displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  art_url: string | null;
  posted_at: string;
};

const SCRAMBLE_CHARS = "!<>-_\\/[]{}—=+*^?#01";
const SCRAMBLE_MS = 900;
const SCRAMBLE_FPS = 30;

// Owner-only "generate one right now" trigger next to the homepage's latest
// transmission panel. Calls the same generation path as the scheduled cron
// (/api/admin/generate-transmission), then plays a short decode/scramble
// animation over the panel before handing the finished post up to the
// parent — nobody but troll_runner ever sees this button.
export default function GenerateTransmission({
  session,
  onGenerated,
}: {
  session: Session | null;
  onGenerated: (post: Post) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [scramble, setScramble] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  if (displayName(session) !== OWNER_USERNAME) return null;

  function runScramble(finalText: string, onDone: () => void) {
    const len = Math.min(finalText.length, 220);
    const start = performance.now();
    let lastFrame = 0;

    function tick(now: number) {
      const elapsed = now - start;
      if (now - lastFrame >= 1000 / SCRAMBLE_FPS) {
        lastFrame = now;
        const progress = Math.min(elapsed / SCRAMBLE_MS, 1);
        const revealCount = Math.floor(progress * len);
        let out = "";
        for (let i = 0; i < len; i++) {
          if (i < revealCount) {
            out += finalText[i];
          } else {
            out += SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
          }
        }
        setScramble(out);
      }
      if (elapsed < SCRAMBLE_MS) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDone();
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setScramble("");
    try {
      const sb = getPublicClient();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/admin/generate-transmission", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "the wire didn't answer");
        setScramble(null);
        setBusy(false);
        return;
      }
      const post = body.post as Post;
      runScramble(post.content, () => {
        setScramble(null);
        setBusy(false);
        onGenerated(post);
      });
    } catch {
      setError("connection to the terminal was lost");
      setScramble(null);
      setBusy(false);
    }
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="glitch-btn text-xs text-problem border border-problem/50 px-2 py-1 hover:bg-problem hover:text-background transition-colors disabled:opacity-50"
      >
        [ {busy ? "transmitting..." : "generate new transmission"} ]
      </button>
      {error && <p className="mt-2 text-alert text-xs">[ {error} ]</p>}
      {scramble !== null && (
        <p
          aria-hidden="true"
          className="gt-scramble mt-3 whitespace-pre-wrap leading-relaxed text-terminal text-sm"
        >
          {scramble || "establishing signal..."}
        </p>
      )}
    </div>
  );
}
