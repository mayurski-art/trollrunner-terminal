"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Frame from "@/components/Frame";
import Meter from "@/components/Meter";

type LoreImage = { id: string; url: string; caption: string };

type File = {
  number: number;
  title: string;
  depth: 1 | 2;
  state: "open" | "sealed";
  body: string | null;
  images: LoreImage[];
  cost: number | null;
};

type SearchHit = { number: number; title: string; snippet: string; reason: string | null };

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

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestId = useRef(0);

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

  // Instant local filter — every open file's title/body, matched client-side
  // as the user types. Zero cost, zero latency, no network round trip.
  const q = query.trim().toLowerCase();
  const localMatches =
    q.length === 0
      ? []
      : files.filter(
          (f) => f.state === "open" && (f.title.toLowerCase().includes(q) || f.body?.toLowerCase().includes(q))
        );

  // Debounced smart-search pass — asks /api/archive/search to re-rank those
  // same open files with a free-tier model and explain why each matches, in
  // voice. Falls back silently to plain keyword hits if that call fails.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (q.length < 3) {
      searchRequestId.current++;
      return;
    }
    const requestId = ++searchRequestId.current;
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await authedFetch("/api/archive/search", {
          method: "POST",
          body: JSON.stringify({ query }),
        });
        const body = await res.json();
        if (requestId !== searchRequestId.current) return;
        if (res.ok) setSuggestions(body.suggestions ?? []);
      } catch {
        // keep the local matches on screen; suggestions are best-effort
      } finally {
        if (requestId === searchRequestId.current) setSearching(false);
      }
    }, 500);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const suggestionsMatchQuery = q.length >= 3;
  const displayedHits: SearchHit[] =
    suggestionsMatchQuery && suggestions.length > 0
      ? suggestions
      : localMatches.map((f) => ({ number: f.number, title: f.title, snippet: f.body?.slice(0, 160) ?? "", reason: null }));

  function jumpTo(number: number) {
    setQuery("");
    setSuggestions([]);
    setOpenNumber(number);
    document.getElementById(`archive-file-${number}`)?.scrollIntoView({ block: "nearest" });
  }

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
      // Keep the nav's counter (components/ProblemsCounter.tsx) in step with
      // the spend that just happened.
      window.dispatchEvent(new Event("problems-changed"));
      setFiles((prev) =>
        prev.map((f) =>
          f.number === number
            ? { ...f, state: "open", title: body.title, body: body.body, images: body.images ?? [], cost: null }
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
        <label className="sr-only" htmlFor="archive-search">
          Search recovered memory files
        </label>
        <input
          id="archive-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search recovered memory..."
          className="w-full bg-transparent border border-dim/60 focus:border-terminal/60 outline-none px-3 py-2 text-sm text-terminal placeholder:text-dim"
        />

        {q.length > 0 && (
          <div className="border border-dim/40 divide-y divide-dim/20">
            {displayedHits.length === 0 ? (
              <p className="text-dim text-xs px-3 py-2">
                {searching ? "searching its memory..." : "no recovered files match that"}
              </p>
            ) : (
              displayedHits.map((hit) => (
                <button
                  key={hit.number}
                  type="button"
                  onClick={() => jumpTo(hit.number)}
                  className="w-full text-left px-3 py-2 hover:bg-terminal/5 transition-colors"
                >
                  <span className="flex items-center gap-2 text-xs sm:text-sm text-terminal">
                    <span className="text-ghost">{String(hit.number).padStart(2, "0")}</span>
                    <span className="truncate">{hit.title}</span>
                  </span>
                  <span className="block text-dim text-xs mt-0.5 truncate">
                    {hit.reason ? hit.reason : hit.snippet}
                  </span>
                </button>
              ))
            )}
            {searching && suggestions.length === 0 && localMatches.length > 0 && (
              <p className="text-dim text-xs px-3 py-1.5 animate-pulse">refining suggestions...</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {files.map((file) => (
          <div key={file.number} id={`archive-file-${file.number}`}>
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
                {file.state === "open" && (
                  <span className="shrink-0 ml-auto text-terminal/60">[ OPEN ]</span>
                )}
              </button>
              {file.state === "sealed" && (
                <button
                  type="button"
                  disabled={unlocking !== null}
                  onClick={() => unlock(file.number)}
                  className="shrink-0 text-problem hover:text-terminal disabled:opacity-40"
                >
                  [ {unlocking === file.number ? "..." : `unlock · ▣${file.cost}`} ]
                </button>
              )}
            </div>

            {file.state === "open" && openNumber === file.number && file.body && (
              <Frame tone="terminal" className="mt-2">
                <p className="whitespace-pre-wrap leading-relaxed text-sm">{file.body}</p>
                {file.images.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {file.images.map((img) => (
                      <figure key={img.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.caption}
                          className="max-w-full border border-dim/40"
                        />
                        <figcaption className="text-dim text-xs mt-1">{img.caption}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </Frame>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
