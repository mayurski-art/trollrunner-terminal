"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Frame from "@/components/Frame";
import Meter from "@/components/Meter";

type File = {
  number: number;
  title: string;
  depth: 1 | 2;
  state: "open" | "sealed";
  body: string | null;
  cost: number | null;
};

// The lore archive — docs/TERMINAL-V4-DESIGN.md §3. Every numbered section
// of TROLL-LORE.md is a file here: recovered for free by chatting about its
// topic (app/api/chat/route.ts's Path A), or forced open by spending
// PROBLEMS (Path B, this component's [ unlock ] button). Sealed files show
// only a title — for depth-2 sections, not even that.
export default function Archive() {
  const [files, setFiles] = useState<File[]>([]);
  const [recoveredCount, setRecoveredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [unlocking, setUnlocking] = useState<number | null>(null);

  const authedFetch = useCallback(async (path: string, init?: RequestInit) => {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return fetch(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await authedFetch("/api/archive");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "the archive is unreachable");
        return;
      }
      setFiles(body.files ?? []);
      setRecoveredCount(body.recoveredCount ?? 0);
      setTotalCount(body.totalCount ?? 0);
      setBalance(body.balance ?? 0);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function unlock(number: number) {
    if (unlocking !== null) return;
    setError(null);
    setUnlocking(number);
    try {
      const res = await authedFetch("/api/archive", {
        method: "POST",
        body: JSON.stringify({ section: number }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "that didn't take");
        return;
      }
      setBalance(body.balance ?? balance);
      setFiles((prev) =>
        prev.map((f) =>
          f.number === number
            ? { ...f, state: "open", title: body.title, body: body.body, cost: null }
            : f
        )
      );
      setRecoveredCount((c) => c + 1);
      setOpenNumber(number);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setUnlocking(null);
    }
  }

  if (loading) {
    return <p className="text-dim text-sm animate-pulse">reading its memory...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Meter
          fraction={totalCount > 0 ? recoveredCount / totalCount : 0}
          tone="terminal"
          label={`recovered memory · ${recoveredCount} / ${totalCount}`}
        />
        <p className="text-problem text-sm">▣ {balance} PROBLEMS</p>
      </div>

      {error && <p className="text-alert text-xs">{error}</p>}

      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.number}>
            <div
              className={`w-full flex items-center justify-between gap-3 px-3 py-2 border text-xs sm:text-sm transition-colors ${
                file.state === "open"
                  ? "border-terminal/40 text-terminal"
                  : "border-dim text-dim"
              }`}
            >
              <button
                type="button"
                disabled={file.state !== "open"}
                onClick={() => setOpenNumber((n) => (n === file.number ? null : file.number))}
                className="flex-1 min-w-0 text-left flex items-center gap-3 disabled:cursor-default"
              >
                <span aria-hidden="true">{file.state === "open" ? "▣" : "▨"}</span>
                <span className="text-ghost">
                  {String(file.number).padStart(2, "0")}
                </span>
                <span className="truncate">{file.title}</span>
              </button>
              {file.state === "sealed" ? (
                <button
                  type="button"
                  disabled={unlocking !== null}
                  onClick={() => unlock(file.number)}
                  className="shrink-0 text-problem hover:text-terminal disabled:opacity-40"
                >
                  [ {unlocking === file.number ? "..." : `unlock · ▣${file.cost}`} ]
                </button>
              ) : (
                <span className="shrink-0 text-terminal/60">[ OPEN ]</span>
              )}
            </div>

            {file.state === "open" && openNumber === file.number && file.body && (
              <Frame tone="terminal" className="mt-2">
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{file.body}</p>
              </Frame>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
