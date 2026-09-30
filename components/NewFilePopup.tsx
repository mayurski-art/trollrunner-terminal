"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import { getPublicClient } from "@/lib/supabase";
import AuthPanel from "@/components/AuthPanel";
import LoreBody from "@/components/LoreBody";
import LockReveal from "@/components/LockReveal";

type LoreImage = { id: string; url: string; caption: string };

type ArchiveFile = {
  number: number;
  title: string;
  state: "open" | "sealed";
  body: string | null;
  images: LoreImage[];
  cost: number | null;
};

type View =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | { kind: "sealed"; cost: number; balance: number }
  | { kind: "opening"; body: string; images: LoreImage[] }
  | { kind: "open"; body: string; images: LoreImage[]; justOpened: boolean };

async function authedFetch(path: string, init?: RequestInit) {
  const { data } = await getPublicClient().auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

// The article the front page's NEW FILE box pops out, over the terminal.
// Reads the same /api/archive the archive page does, so an already-recovered
// file just opens; a sealed one shows its padlock and a [ spend a PROBLEM ]
// button, and the lock springs open (components/LockReveal.tsx) before the
// text comes in. Signed-out visitors get the sign-in panel.
export default function NewFilePopup({
  number,
  title,
  onClose,
}: {
  number: number;
  title: string;
  onClose: () => void;
}) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [spending, setSpending] = useState(false);
  const [spendError, setSpendError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/archive");
      const data = await res.json();
      if (!res.ok) {
        setView({ kind: "error", message: data.error ?? "the archive is unreachable" });
        return;
      }
      const file = (data.files as ArchiveFile[]).find((f) => f.number === number);
      if (!file) {
        setView({ kind: "error", message: "that file has gone missing" });
      } else if (file.state === "open" && file.body) {
        setView({ kind: "open", body: file.body, images: file.images, justOpened: false });
      } else {
        setView({ kind: "sealed", cost: file.cost ?? 1, balance: data.balance ?? 0 });
      }
    } catch {
      setView({ kind: "error", message: "connection to the terminal was lost" });
    }
  }, [number]);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView({ kind: "signed-out" });
      return;
    }
    setView({ kind: "loading" });
    load();
  }, [session, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function spend() {
    if (spending) return;
    setSpending(true);
    setSpendError(null);
    try {
      const res = await authedFetch("/api/archive", {
        method: "POST",
        body: JSON.stringify({ section: number }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSpendError(data.error ?? "that didn't take");
        return;
      }
      window.dispatchEvent(new Event("problems-changed"));
      setView({ kind: "opening", body: data.body, images: data.images ?? [] });
    } catch {
      setSpendError("connection to the terminal was lost");
    } finally {
      setSpending(false);
    }
  }

  const finishOpening = useCallback(() => {
    setView((v) => (v.kind === "opening" ? { kind: "open", body: v.body, images: v.images, justOpened: true } : v));
  }, []);

  const locked = view.kind === "sealed" || view.kind === "opening";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`new file ${number}: ${title}`}
      onClick={onClose}
      className="nfp-backdrop fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-sm p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nfp-panel relative w-full max-w-3xl max-h-[88vh] flex flex-col border border-terminal bg-panel shadow-[0_0_40px_rgba(0,0,0,0.6)]"
      >
        <span className="absolute -top-2.5 left-3 bg-panel px-1.5 text-terminal text-[10px] lg:text-sm tracking-wide">
          [ new file · §{number} ]
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="close"
          className="absolute -top-2.5 right-2 bg-panel px-1.5 text-dim hover:text-terminal text-[10px] lg:text-sm leading-none"
        >
          [ x ]
        </button>

        <div className="overflow-y-auto px-4 sm:px-6 pt-6 pb-5">
          <h2 className="text-foreground text-base lg:text-xl leading-snug mb-4">{title}</h2>

          {view.kind === "loading" && <p className="text-dim text-sm animate-pulse">pulling it from the stacks...</p>}

          {view.kind === "error" && <p className="text-alert text-sm">{view.message}</p>}

          {view.kind === "signed-out" && (
            <div className="space-y-4">
              <p className="text-dim text-sm">sign in to recover this file.</p>
              <AuthPanel />
            </div>
          )}

          {locked && (
            <div className="nfp-sealed flex flex-col items-center text-center py-6">
              <LockReveal
                size={3.5}
                opening={view.kind === "opening"}
                onOpened={view.kind === "opening" ? finishOpening : undefined}
                className="mb-5"
              />
              {/* Redaction bars standing in for the sealed text. */}
              <div className="w-full max-w-md space-y-1.5 mb-5" aria-hidden="true">
                {[92, 100, 78, 96, 54].map((w, i) => (
                  <span key={i} className="nfp-redact block h-[0.9em]" style={{ width: `${w}%`, animationDelay: `${i * 0.4}s` }} />
                ))}
              </div>
              {view.kind === "sealed" ? (
                <>
                  <p className="text-dim text-xs lg:text-sm mb-3">
                    this file is sealed. you have <span className="text-problem">▣ {view.balance}</span>
                  </p>
                  {view.balance >= view.cost ? (
                    <button
                      type="button"
                      onClick={spend}
                      disabled={spending}
                      className="nfp-spend text-problem border border-problem/60 px-3 py-1.5 text-sm hover:text-terminal hover:border-terminal disabled:opacity-50"
                    >
                      [ {spending ? "..." : `use ▣${view.cost} PROBLEM to unlock`} ]
                    </button>
                  ) : (
                    <p className="text-alert text-xs lg:text-sm">
                      not enough PROBLEMS. it costs ▣{view.cost}.
                    </p>
                  )}
                  {spendError && <p className="text-alert text-xs mt-2">{spendError}</p>}
                </>
              ) : (
                <p className="text-terminal text-xs lg:text-sm tracking-widest uppercase animate-pulse">unsealing</p>
              )}
            </div>
          )}

          {view.kind === "open" && (
            <div className={view.justOpened ? "nfp-article-in" : undefined}>
              <LoreBody body={view.body} images={view.images} />
              <p className="mt-6 text-xs">
                <a
                  href={`/archive?file=${number}`}
                  className="text-dim underline decoration-dim underline-offset-4 hover:text-terminal"
                >
                  [ see it in the archive ]
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
