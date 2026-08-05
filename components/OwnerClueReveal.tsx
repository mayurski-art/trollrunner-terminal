"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";
import { displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

// Owner-only reveal for the clue behind the latest voice transmission —
// nobody but troll_runner ever sees this link, let alone its result.
export default function OwnerClueReveal({ session }: { session: Session | null }) {
  const [clue, setClue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (displayName(session) !== OWNER_USERNAME) return null;

  async function reveal() {
    if (busy || clue) return;
    setBusy(true);
    setError(null);
    try {
      const sb = getPublicClient();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/admin/latest-clue", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "could not fetch the clue");
        return;
      }
      setClue(body.clue ?? "[no clue recorded for this transmission]");
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusy(false);
    }
  }

  return (
    <p className="mt-2 text-xs text-dim">
      clues{" "}
      {clue ? (
        <span className="text-blue-400">{clue}</span>
      ) : (
        <button
          type="button"
          onClick={reveal}
          disabled={busy}
          className="text-blue-400 hover:underline disabled:opacity-40"
        >
          [{busy ? "..." : "answer"}]
        </button>
      )}
      {error && <span className="text-alert"> [ {error} ]</span>}
    </p>
  );
}
