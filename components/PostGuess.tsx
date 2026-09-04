"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";

type GuessState = {
  attempts: number;
  correct: boolean;
  resolved: boolean;
  netDelta?: number | null;
} | null;
type Stage = "idle" | "confirming" | "open" | "grading";

// Same glyph set CrypticWait uses for the "decoding" strip — the grading
// pause should read as the terminal working, not a generic spinner.
const GLYPHS = "▓▒░█⊕⊗◇◉△▽●○⋅·:;~`'";
const GRADE_STRIP_LENGTH = 24;
const GRADE_TICK_MS = 90;
// Minimum time to sit in "grading" even if the server answers instantly —
// otherwise a fast response skips straight past the animation.
const MIN_GRADE_MS = 900;

function randomGlyphs(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  return out;
}

async function authHeader(): Promise<Record<string, string>> {
  const sb = getPublicClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function PostGuess({
  postId,
  session,
}: {
  postId: string;
  session: Session | null;
}) {
  const [loaded, setLoaded] = useState(false);
  const [guessable, setGuessable] = useState(false);
  const [guessState, setGuessState] = useState<GuessState>(null);
  const [balance, setBalance] = useState(0);
  const [cost, setCost] = useState(1);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [stage, setStage] = useState<Stage>("idle");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeStrip, setGradeStrip] = useState("");
  const [justResolved, setJustResolved] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setGuessState(null);
    setStage("idle");
    setError(null);
    setInput("");
    setJustResolved(false);
    if (!session) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const headers = await authHeader();
      try {
        const res = await fetch(`/api/post-guess?postId=${encodeURIComponent(postId)}`, {
          headers,
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setGuessable(!!data.guessable);
          setGuessState(data.guess ?? null);
          setBalance(data.wallet?.balance ?? 0);
          setCost(data.cost ?? 1);
          setMaxAttempts(data.maxAttempts ?? 2);
          // Already started (page reload mid-attempt) — skip the confirm
          // step, go straight back to the open input.
          if (data.guess && !data.guess.resolved) setStage("open");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, session]);

  // Ticks the scramble strip while stage === "grading".
  useEffect(() => {
    if (stage !== "grading") return;
    setGradeStrip(randomGlyphs(GRADE_STRIP_LENGTH));
    const id = setInterval(() => {
      setGradeStrip(randomGlyphs(GRADE_STRIP_LENGTH));
    }, GRADE_TICK_MS);
    return () => clearInterval(id);
  }, [stage]);

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    const guess = input.trim();
    if (!guess || busy) return;
    setBusy(true);
    setError(null);
    setStage("grading");
    const startedAt = Date.now();
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/post-guess", {
        method: "POST",
        headers,
        body: JSON.stringify({ postId, guess }),
      });
      const data = await res.json();

      // Let the grading animation play for at least MIN_GRADE_MS so it
      // never gets skipped by a fast response.
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_GRADE_MS) {
        await new Promise((r) => setTimeout(r, MIN_GRADE_MS - elapsed));
      }

      if (!res.ok) {
        setError(data.error ?? "the guess didn't land");
        setStage("open");
        return;
      }
      setJustResolved(!!data.resolved);
      setGuessState({
        attempts: data.attempts,
        correct: data.correct,
        resolved: data.resolved,
        netDelta: data.netDelta ?? null,
      });
      setBalance(data.wallet?.balance ?? balance);
      setInput("");
      setStage(data.resolved ? "idle" : "open");
    } catch {
      setError("connection to the terminal was lost");
      setStage("open");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded || !session || !guessable) return null;

  if (guessState?.resolved) {
    const delta = guessState.netDelta ?? 0;
    const sign = delta > 0 ? "+" : "";
    const animClass = justResolved
      ? guessState.correct
        ? "pg-correct-lock"
        : "pg-wrong-glitch"
      : "";
    return (
      <p className="mt-2 text-xs text-dim">
        transmission{" "}
        <span
          className={`${guessState.correct ? "text-problem" : "text-alert"} ${animClass}`}
        >
          [{guessState.correct ? "cracked" : "rekted"}
          {guessState.netDelta != null && ` — ${sign}${delta} PROBLEM${Math.abs(delta) === 1 ? "" : "S"} earned`}
          ]
        </span>
      </p>
    );
  }

  if (stage === "grading") {
    return (
      <div className="mt-3 pt-3 border-t border-dim" role="status" aria-live="polite">
        <p className="sr-only">grading transmission…</p>
        <p
          aria-hidden="true"
          className="text-[10px] tracking-[0.4em] text-center text-problem/70 mb-1.5 animate-pulse"
        >
          ▓▓ grading guess ▓▓
        </p>
        <div
          aria-hidden="true"
          className="pg-grading-glyph text-[10px] tracking-[0.4em] text-center text-terminal overflow-hidden whitespace-nowrap"
        >
          {gradeStrip}
        </div>
      </div>
    );
  }

  if (stage === "idle") {
    return (
      <div className="mt-3 pt-3 border-t border-dim">
        <button
          type="button"
          onClick={() => setStage("confirming")}
          className="text-problem text-xs hover:underline"
        >
          [ try to decipher this transmission ]
        </button>
      </div>
    );
  }

  if (stage === "confirming") {
    return (
      <div className="mt-3 pt-3 border-t border-dim">
        <p className="text-dim text-xs">
          ready to answer? only {maxAttempts} attempts, each costs {cost} PROBLEM
          {cost === 1 ? "" : "S"}.
        </p>
        <div className="mt-1.5 flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => setStage("open")}
            className="text-problem hover:underline"
          >
            [ yes, spend {cost} PROBLEM{cost === 1 ? "" : "S"} ]
          </button>
          <button
            type="button"
            onClick={() => setStage("idle")}
            className="text-ghost hover:text-terminal transition-colors"
          >
            [ not now ]
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-dim">
      <form onSubmit={submitGuess} className="space-y-1.5">
        <p className="text-dim text-xs">
          what's it circling? ({maxAttempts - (guessState?.attempts ?? 0)} guess
          {maxAttempts - (guessState?.attempts ?? 0) === 1 ? "" : "es"} left · balance {balance})
        </p>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="your guess_"
            maxLength={200}
            disabled={busy}
            className="flex-1 bg-transparent border border-dim px-2 py-1 text-xs text-you outline-none focus:border-problem disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="border border-problem text-problem px-2 text-xs hover:bg-problem hover:text-background transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            turn in
          </button>
        </div>
        {error && <p className="text-alert text-xs">[ {error} ]</p>}
      </form>
    </div>
  );
}
