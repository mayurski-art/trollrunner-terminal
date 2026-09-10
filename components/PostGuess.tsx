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

type InitialState = {
  guessable: boolean;
  guess: GuessState;
  balance: number;
  cost: number;
  maxAttempts: number;
};

// The logs grid mounts a PostGuess per card, then the [ pop out ] modal
// mounts a second one for the same post — without this, that second mount
// re-fetches /api/post-guess from scratch and sits blank ("[ try to
// decipher this transmission ]" doesn't appear right away) until it
// resolves, even though the card already just fetched the same thing.
// Keyed per (postId, userId) since the answer depends on who's asking.
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
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [stage, setStage] = useState<Stage>("idle");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gradeStrip, setGradeStrip] = useState("");
  const [justResolved, setJustResolved] = useState(false);

  // Keyed on the user id, not the session object itself — Supabase re-emits
  // onAuthStateChange (and hands page.tsx a brand-new session object, same
  // user) on things like a token refresh, which fires reliably on tab/app
  // focus. Depending on the whole session reference re-ran this effect on
  // every alt-tab back to the browser, flipping loaded back to false and
  // making "[ try to decipher this transmission ]" blink out until the
  // refetch resolved. The user id only changes on an actual login/logout.
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
      setMaxAttempts(cached.maxAttempts);
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
            maxAttempts: data.maxAttempts ?? 2,
          };
          initialStateCache.set(cacheKey(postId, userId), state);
          setGuessable(state.guessable);
          setGuessState(state.guess);
          setBalance(state.balance);
          setCost(state.cost);
          setMaxAttempts(state.maxAttempts);
          // Already started (page reload mid-attempt) — skip the confirm
          // step, go straight back to the open input.
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

  // Ticks the scramble strip while stage === "grading".
  useEffect(() => {
    if (stage !== "grading") return;
    setGradeStrip(randomGlyphs(GRADE_STRIP_LENGTH));
    const id = setInterval(() => {
      setGradeStrip(randomGlyphs(GRADE_STRIP_LENGTH));
    }, GRADE_TICK_MS);
    return () => clearInterval(id);
  }, [stage]);

  // Re-sync the server's answer whenever the tab comes back to the
  // foreground. Mobile browsers kill in-flight fetches when the app is
  // swiped away, so submitGuess's catch fires and the user sees a
  // connection error — but the POST handler already graded the guess,
  // charged the PROBLEMS and wrote the row before responding, so the work
  // really did happen and only the response was lost. Re-reading state on
  // return turns that dropped response into the correct resolved/attempts
  // display instead of a false failure (and a wasted retry that would
  // charge them again). Cheap enough to run on every foreground: it's one
  // GET, and it also repairs state after a guess made in another tab.
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
        setGuessState(serverGuess);
        setBalance(serverBalance);
        // The server is the authority on how far this guess got, so a
        // dropped response can't leave the UI stuck on the grading strip
        // or on an error from a request that actually succeeded.
        setError(null);
        setStage(serverGuess?.resolved ? "idle" : serverGuess ? "open" : "idle");
        const existing = initialStateCache.get(cacheKey(postId, userId));
        if (existing) {
          initialStateCache.set(cacheKey(postId, userId), {
            ...existing,
            guess: serverGuess,
            balance: serverBalance,
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
      const newGuessState: GuessState = {
        attempts: data.attempts,
        correct: data.correct,
        resolved: data.resolved,
        netDelta: data.netDelta ?? null,
      };
      const newBalance = data.wallet?.balance ?? balance;
      setGuessState(newGuessState);
      setBalance(newBalance);
      setInput("");
      setStage(data.resolved ? "idle" : "open");
      // Keep the cross-mount cache (card + pop-out modal) in step so the
      // other mount doesn't show a stale pre-guess state next time it opens.
      if (userId) {
        const existing = initialStateCache.get(cacheKey(postId, userId));
        if (existing) {
          initialStateCache.set(cacheKey(postId, userId), {
            ...existing,
            guess: newGuessState,
            balance: newBalance,
          });
        }
      }
    } catch {
      // Could be a real network failure, or just this tab being backgrounded
      // mid-request (mobile kills in-flight fetches on swipe-away) — in the
      // latter case the guess was already graded server-side. Don't claim it
      // failed; the visibilitychange effect above re-syncs the real state as
      // soon as they come back.
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
