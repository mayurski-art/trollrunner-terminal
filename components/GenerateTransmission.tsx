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
  // The freshly generated post, held for accept/trash. It already exists in
  // the database but is flagged pending, so no public surface shows it while
  // this is set.
  const [review, setReview] = useState<Post | null>(null);
  const [deciding, setDeciding] = useState(false);
  const rafRef = useRef<number | null>(null);

  async function authHeader(): Promise<Record<string, string>> {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

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
      const res = await fetch("/api/admin/generate-transmission", {
        method: "POST",
        headers: await authHeader(),
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
        // Held for review rather than handed straight up: the post exists in
        // the database but is flagged pending, so nothing public shows it
        // until accept clears the flag.
        setReview(post);
      });
    } catch {
      setError("connection to the terminal was lost");
      setScramble(null);
      setBusy(false);
    }
  }

  async function accept() {
    if (!review || deciding) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/generate-transmission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id: review.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "could not accept it");
        return;
      }
      const post = (body.post as Post) ?? review;
      setReview(null);
      onGenerated(post);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setDeciding(false);
    }
  }

  async function trash() {
    if (!review || deciding) return;
    setDeciding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/generate-transmission", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ id: review.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "could not discard it");
        return;
      }
      setReview(null);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={generate}
        disabled={busy || review !== null}
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
      {review && (
        <div className="mt-3 border border-problem/40 p-3">
          <p className="text-ghost text-xs mb-2">
            [ holding — nobody sees this until you accept it ]
          </p>
          <p className="whitespace-pre-wrap leading-relaxed text-terminal text-sm mb-3">
            {review.content}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={deciding}
              aria-label="Accept this transmission and publish it to the logs"
              className="text-xs text-terminal border border-terminal px-2 py-1 hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
            >
              ✓ accept
            </button>
            <button
              type="button"
              onClick={trash}
              disabled={deciding}
              aria-label="Discard this transmission permanently"
              className="text-xs text-alert border border-alert/50 px-2 py-1 hover:bg-alert hover:text-background transition-colors disabled:opacity-40"
            >
              🗑 trash
            </button>
            {deciding && <span className="text-dim text-xs animate-pulse">working...</span>}
          </div>
        </div>
      )}
    </div>
  );
}