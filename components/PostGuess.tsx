"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";

type GuessState = {
  attempts: number;
  correct: boolean;
  resolved: boolean;
  awaitingReview?: boolean;
  netDelta?: number | null;
} | null;
type Stage = "idle" | "confirming" | "open" | "grading";

const GLYPHS = "▓▒░█⊕⊗◇◉△▽●○⋅·:;~`'";
const GRADE_STRIP_LENGTH = 24;
const GRADE_TICK_MS = 90;
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

type InitialState = {
  guessable: boolean;
  guess: GuessState;
  balance: number;
  cost: number;
  bonus: number;
};

const initialStateCache = new Map<string, InitialState>();

function cacheKey(postId: string, userId: string): string {
  return `${userId}:${postId}`;
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
  const [bonus, setBonus] = useState(10);
  const [stage, setStage] = useState<Stage>("idle");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeStrip, setGradeStrip] = useState("");
  const [justResolved, setJustResolved] = useState(false);
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    setGuessState(null);
    setStage("idle");
    setError(null);
    setInput("");
    setJustResolved(false);
    if (!userId) {
      setLoaded(true);
      return;
    }

    const cached = initialStateCache.get(cacheKey(postId, userId));
    if (cached) {
      setGuessable(cached.guessable);
      setGuessState(cached.guess);
      setBalance(cached.balance);
      setCost(cached.cost);
      setBonus(cached.bonus);
      if (cached.guess && !cached.guess.resolved) setStage("open");
      setLoaded(true);
      return;
    }

    setLoaded(false);
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
          const state: InitialState = {
            guessable: !!data.guessable,
            guess: data.guess ?? null,
            balance: data.wallet?.balance ?? 0,
            cost: data.cost ?? 1,
            bonus: data.bonus ?? 10,
          };
          initialStateCache.set(cacheKey(postId, userId), state);
          setGuessable(state.guessable);
          setGuessState(state.guess);
          setBalance(state.balance);
          setCost(state.cost);
          setBonus(state.bonus);
          if (state.guess && !state.guess.resolved) setStage("open");
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, userId]);

  useEffect(() => {
    if (stage !== "grading") return;
    setGradeStrip(randomGlyphs(GRADE_STRIP_LENGTH));
    const id = setInterval(() => {
      setGradeStrip(randomGlyphs(GRADE_STRIP_LENGTH));
    }, GRADE_TICK_MS);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (!userId || !guessable) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/post-guess?postId=${encodeURIComponent(postId)}`, {
          headers: await authHeader(),
        });
        if (!res.ok) return;
        const data = await res.json();
        const serverGuess: GuessState = data.guess ?? null;
        const serverBalance = data.wallet?.balance ?? 0;
        const serverBonus = data.bonus ?? 10;
        setGuessState(serverGuess);
        setBalance(serverBalance);
        setBonus(serverBonus);
        setError(null);
        setStage(serverGuess?.resolved ? "idle" : serverGuess ? "open" : "idle");
        const existing = initialStateCache.get(cacheKey(postId, userId));
        if (existing) {
          initialStateCache.set(cacheKey(postId, userId), {
            ...existing,
            guess: serverGuess,
            balance: serverBalance,
            bonus: serverBonus,
          });
        }
      } catch {
        // still offline — leave whatever's on screen alone
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [postId, userId, guessable]);

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
      const newGuessState: GuessState = {
        attempts: data.attempts,
        correct: data.correct,
        resolved: data.resolved,
        awaitingReview: !!data.awaitingReview,
        netDelta: data.netDelta ?? null,
      };
      const newBalance = data.wallet?.balance ?? balance;
      setGuessState(newGuessState);
      setBalance(newBalance);
      setBonus(data.bonus ?? bonus);
      window.dispatchEvent(new Event("problems-changed"));
      setInput("");
      setStage(data.resolved ? "idle" : "open");
      if (userId) {
        const existing = initialStateCache.get(cacheKey(postId, userId));
        if (existing) {
          initialStateCache.set(cacheKey(postId, userId), {
            ...existing,
            guess: newGuessState,
            balance: newBalance,
            bonus: data.bonus ?? bonus,
          });
        }
      }
    } catch {
      if (document.visibilityState === "visible") {
        setError("connection to the terminal was lost");
      }
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
      <p className="mt-2 text-xs text-dim" role="status" aria-live="polite">
        transmission{" "}
        <span className={`${guessState.correct ? "text-problem" : guessState.awaitingReview ? "text-problem" : "text-alert"} ${animClass}`}>
          {guessState.correct
            ? `[ cracked — ${sign}${delta} PROBLEM${Math.abs(delta) === 1 ? "" : "S"} earned ]`
            : guessState.awaitingReview
              ? "[ waiting for manual approval ]"
              : "[ not approved ]"}
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
          className="text-[10px] lg:text-sm tracking-[0.4em] text-center text-problem/70 mb-1.5 animate-pulse"
        >
          ▓▓ grading guess ▓▓
        </p>
        <div
          aria-hidden="true"
          className="pg-grading-glyph text-[10px] lg:text-sm tracking-[0.4em] text-center text-terminal overflow-hidden whitespace-nowrap"
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
          each attempt costs {cost} PROBLEM{cost === 1 ? "" : "S"}; a correct answer earns +{bonus} PROBLEMS.
          guess as many times as you like. close answers are auto-approved; other guesses wait for manual review.
        </p>
        <div className="mt-1.5 flex gap-3 text-xs">
          <button type="button" onClick={() => setStage("open")} className="text-problem hover:underline">
            [ yes, let me guess ]
          </button>
          <button type="button" onClick={() => setStage("idle")} className="text-ghost hover:text-terminal transition-colors">
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
          what's it circling? ({cost} PROBLEM{cost === 1 ? "" : "S"} per guess · correct answer +{bonus} PROBLEMS
          {guessState?.attempts ? ` · ${guessState.attempts} tried` : ""} · balance {balance})
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
