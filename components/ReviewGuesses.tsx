"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import Frame from "@/components/Frame";

type Guess = {
  id: string;
  post_id: string;
  user_id: string;
  last_guess_text: string | null;
  attempts: number;
  correct: boolean;
  resolved: boolean;
  cost_paid: number;
  overridden_by: string | null;
  created_at: string;
  resolved_at: string | null;
  terminal_posts: { clue_tag: string | null; content: string } | null;
};

// Every resolved guess against a transmission, newest first, so the owner
// can catch cases where gradeGuess()'s word-overlap heuristic (lib/
// musingGuess.ts) denied something a human would call close enough — and
// flip it by hand. Correct guesses are shown too, just for context; only
// "denied" ones get an override button.
export default function ReviewGuesses() {
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const authedFetch = useCallback(async (init?: RequestInit) => {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return fetch("/api/admin/guesses", {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch();
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(body.error ?? "could not reach the ledger");
        else setGuesses(body.guesses ?? []);
      } catch {
        if (!cancelled) setError("connection to the terminal was lost");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  async function override(id: string) {
    setError(null);
    setBusyId(id);
    try {
      const res = await authedFetch({ method: "POST", body: JSON.stringify({ id }) });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "that didn't take");
        return;
      }
      setGuesses((prev) => prev.map((g) => (g.id === id ? { ...g, ...body.guess } : g)));
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-dim text-sm animate-pulse">reading the ledger...</p>;
  }

  const denied = guesses.filter((g) => !g.correct);
  const visible = showCorrect ? guesses : denied;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="text-problem text-sm">
          ▣ {denied.length} denied
          <span className="text-dim"> · {guesses.length} total</span>
        </p>
        <button
          type="button"
          onClick={() => setShowCorrect((v) => !v)}
          className="text-xs text-dim hover:text-terminal"
        >
          [ {showCorrect ? "hide" : "show"} correct guesses ]
        </button>
      </div>

      {error && <p className="text-alert text-xs">{error}</p>}

      {visible.length === 0 && (
        <p className="text-dim text-sm">nothing waiting. the ledger is quiet.</p>
      )}

      {visible.map((g) => (
        <GuessRow key={g.id} guess={g} busy={busyId === g.id} onOverride={override} />
      ))}
    </div>
  );
}

function GuessRow({
  guess,
  busy,
  onOverride,
}: {
  guess: Guess;
  busy: boolean;
  onOverride: (id: string) => void;
}) {
  return (
    <Frame tone={guess.correct ? "dim" : "problem"}>
      <div className="flex items-center gap-3 text-xs text-dim mb-2 flex-wrap">
        <span>{timeAgo(guess.resolved_at ?? guess.created_at)}</span>
        <span>·</span>
        <span>{guess.attempts} attempt{guess.attempts === 1 ? "" : "s"}</span>
        {guess.correct ? (
          <span className="text-terminal">▣ correct{guess.overridden_by ? " (overridden)" : ""}</span>
        ) : (
          <span className="text-alert">▨ denied</span>
        )}
        {guess.terminal_posts?.clue_tag && (
          <span className="text-blue-400">answer: {guess.terminal_posts.clue_tag}</span>
        )}
      </div>

      {guess.terminal_posts?.content && (
        <p className="text-dim text-xs mb-2 line-clamp-2">{guess.terminal_posts.content}</p>
      )}

      <p className="text-terminal text-sm">
        {guess.last_guess_text ?? (
          <span className="text-dim italic">no guess text recorded</span>
        )}
      </p>

      {!guess.correct && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => onOverride(guess.id)}
            disabled={busy}
            className="text-xs text-terminal hover:text-problem disabled:opacity-40"
          >
            [ {busy ? "approving..." : "approve as correct"} ]
          </button>
        </div>
      )}
    </Frame>
  );
}
