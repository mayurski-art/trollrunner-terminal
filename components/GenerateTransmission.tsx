"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";
import { displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

type Post = {
  id: string;
  content: string;
  clue_tag: string | null;
  x_post_url: string | null;
  art_url: string | null;
  posted_at: string;
};

// Owner-only "generate one right now" trigger next to the homepage's latest
// transmission panel. Calls the same generation path as the scheduled cron
// (/api/admin/generate-transmission) and holds the result for accept/trash —
// nobody but troll_runner ever sees this button.
//
// While a generation is in flight the parent swaps the live transmission text
// for the cryptic waiting animation (onPendingChange), so the panel shows the
// old post dissolving into signal rather than sitting there stale.
export default function GenerateTransmission({
  session,
  onGenerated,
  onPendingChange,
  onReviewChange,
  steerRef,
}: {
  session: Session | null;
  onGenerated: (post: Post) => void;
  onPendingChange?: (pending: boolean) => void;
  onReviewChange?: (post: Post | null) => void;
  // Filled in with a "regenerate with this note" function so the chat panel
  // can steer the pending draft ("make it darker").
  steerRef?: React.MutableRefObject<((note: string) => void) | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The freshly generated post, held for accept/trash. It already exists in
  // the database but is flagged pending, so no public surface shows it while
  // this is set.
  const [review, setReview] = useState<Post | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [steer, setSteer] = useState("");

  const isOwner = displayName(session) === OWNER_USERNAME;

  const authHeader = useCallback(async (): Promise<Record<string, string>> => {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  useEffect(() => {
    onPendingChange?.(busy);
  }, [busy, onPendingChange]);

  useEffect(() => {
    onReviewChange?.(review);
  }, [review, onReviewChange]);

  // Recover a draft stranded by a reload. Without this the pending post stays
  // invisible to everyone — public readers filter pending out, and the review
  // card only ever existed in memory.
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/generate-transmission", {
          headers: await authHeader(),
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body.post) setReview(body.post as Post);
      } catch {
        // a missing draft is not worth surfacing on mount
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOwner, authHeader]);

  const generate = useCallback(
    async (note?: string) => {
      // Re-entry guard read through the updater rather than a ref, so a steer
      // arriving from the chat panel mid-generation is dropped instead of
      // racing a second request against the one in flight.
      let alreadyRunning = false;
      setBusy((running) => {
        alreadyRunning = running;
        return true;
      });
      if (alreadyRunning) return;
      setError(null);
      try {
        const res = await fetch("/api/admin/generate-transmission", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeader()) },
          body: JSON.stringify({
            steer: note ?? "",
            // Regenerating from the review card retires the draft it replaces,
            // so rejected drafts don't accumulate as invisible pending rows.
            replaces: review?.id ?? "",
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? "the wire didn't answer");
          return;
        }
        // Held for review rather than handed straight up: the post exists in
        // the database but is flagged pending, so nothing public shows it
        // until accept clears the flag.
        setReview(body.post as Post);
        setSteer("");
      } catch {
        setError("connection to the terminal was lost");
      } finally {
        setBusy(false);
      }
    },
    [authHeader, review]
  );

  // A steer typed into the chat panel regenerates the draft from here, so the
  // review card stays the single place a pending transmission lives. The
  // parent invokes this through a ref rather than a state prop — driving a
  // generation from an effect would fire it as a render side effect.
  useEffect(() => {
    if (!steerRef) return;
    steerRef.current = generate;
    return () => {
      steerRef.current = null;
    };
  }, [steerRef, generate]);

  if (!isOwner) return null;

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
        onClick={() => generate()}
        disabled={busy || review !== null}
        className="glitch-btn text-xs text-problem border border-problem/50 px-2 py-1 hover:bg-problem hover:text-background transition-colors disabled:opacity-50"
      >
        [ {busy ? "transmitting..." : "generate new transmission"} ]
      </button>
      {error && <p className="mt-2 text-alert text-xs">[ {error} ]</p>}
      {review && (
        <div className="mt-3 border border-problem/40 p-3">
          <p className="text-ghost text-xs mb-2">
            [ holding — nobody sees this until you accept it ]
          </p>
          <p className="whitespace-pre-wrap leading-relaxed text-terminal text-sm mb-3">
            {review.content}
          </p>
          {review.clue_tag && (
            <p className="text-ghost text-xs mb-3">
              answer — <span className="text-problem">{review.clue_tag}</span>
            </p>
          )}
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const note = steer.trim();
              if (note && !busy && !deciding) generate(note);
            }}
            className="mt-3 pt-3 border-t border-dim/40"
          >
            <label htmlFor="gt-steer" className="text-ghost text-xs">
              or tell it what to change
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="gt-steer"
                value={steer}
                onChange={(e) => setSteer(e.target.value)}
                placeholder="make it darker, tie it to the bridge..."
                maxLength={500}
                disabled={busy || deciding}
                className="flex-1 bg-transparent border border-dim px-2 py-1 text-xs text-you outline-none focus:border-problem disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy || deciding || !steer.trim()}
                className="border border-problem text-problem px-2 text-xs hover:bg-problem hover:text-background transition-colors disabled:opacity-40"
              >
                {busy ? "..." : "redo"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}