"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Frame from "@/components/Frame";
import Meter from "@/components/Meter";
import { buildLoreFlow, isLoopGifAsset } from "@/lib/loreAssets";

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
  const [lightbox, setLightbox] = useState<{ url: string; caption: string } | null>(null);
  // Pan offset for the enlarged lightbox image, in CSS pixels — reset every
  // time a new image opens so drag position never bleeds from one image to
  // the next. Mirrors Chat.tsx's lightbox exactly, so enlarging an image
  // reads the same whether it came from chat or the archive.
  const panRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const didDragRef = useRef(false);
  const lightboxImgRef = useRef<HTMLImageElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    panRef.current = { x: 0, y: 0 };
    if (lightboxImgRef.current) lightboxImgRef.current.style.transform = "translate(0px, 0px)";
  }, [lightbox]);

  function lightboxPointerDown(e: React.PointerEvent<HTMLImageElement>) {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: panRef.current.x, panY: panRef.current.y };
    didDragRef.current = false;
    setDragging(true);
  }

  function lightboxPointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const start = dragStartRef.current;
    if (!start) return;
    const x = start.panX + (e.clientX - start.x);
    const y = start.panY + (e.clientY - start.y);
    if (Math.abs(x - start.panX) > 3 || Math.abs(y - start.panY) > 3) didDragRef.current = true;
    panRef.current = { x, y };
    if (lightboxImgRef.current) lightboxImgRef.current.style.transform = `translate(${x}px, ${y}px)`;
  }

  function lightboxPointerUp(e: React.PointerEvent<HTMLImageElement>) {
    if (dragStartRef.current) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragStartRef.current = null;
    setDragging(false);
  }

  // The click that follows pointerup is a separate event from pointerdown/up
  // and still bubbles to the backdrop's onClick (which closes the lightbox)
  // unless stopped here — but only when an actual drag happened.
  function lightboxImageClick(e: React.MouseEvent<HTMLImageElement>) {
    if (didDragRef.current) e.stopPropagation();
  }

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

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

  // Deep link from the front page's archive-of-the-day panel
  // (/archive?file=N): expand that file once the manifest has loaded, and
  // scroll it into view. Only expands files that are actually open —
  // pointing at a sealed one just scrolls to it with its [ unlock ] button
  // showing, which is the intended funnel.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || files.length === 0) return;
    const raw = new URLSearchParams(window.location.search).get("file");
    if (!raw) return;
    const number = Number(raw);
    if (!Number.isInteger(number)) return;
    const target = files.find((f) => f.number === number);
    if (!target) return;
    deepLinkedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (target.state === "open") setOpenNumber(number);
    // Deferred a frame so the expanded body is in the DOM before scrolling,
    // otherwise the card is measured at its collapsed height and lands off
    // position.
    requestAnimationFrame(() => {
      document
        .getElementById(`archive-file-${number}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [files]);

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

      <div className="space-y-2 max-w-xl">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-start">
        {files.map((file) => (
          <div
            key={file.number}
            id={`archive-file-${file.number}`}
            className={openNumber === file.number && file.state === "open" ? "md:col-span-2" : ""}
          >
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
                {/* Prose and pictures interleave (lib/loreAssets.ts's
                    buildLoreFlow) so an image lands beside the part of the
                    file it illustrates, instead of every picture stacking
                    into a contact sheet under the finished article. */}
                <div
                  className="select-none"
                  onCopy={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {buildLoreFlow(file.body, file.images).map((item, i) =>
                    item.kind === "text" ? (
                      <p
                        key={`t${i}`}
                        className="whitespace-pre-wrap leading-relaxed text-sm [&:not(:first-child)]:mt-4"
                      >
                        {item.text}
                      </p>
                    ) : (
                      <div
                        key={`i${i}`}
                        className={`my-4 grid grid-cols-1 gap-3 ${
                          item.images.length > 1 ? "sm:grid-cols-2" : ""
                        }`}
                      >
                        {item.images.map((img) => (
                          <figure key={img.id}>
                            {isLoopGifAsset(img.url) ? (
                              <video
                                src={img.url}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="max-h-[32rem] w-auto max-w-full object-contain border border-dim/40"
                                aria-label={img.caption}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLightbox({ url: img.url, caption: img.caption })}
                                aria-label={`View full-size: ${img.caption}`}
                                data-cursor="zoom"
                                className="block w-full cursor-zoom-in"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img.url}
                                  alt={img.caption}
                                  className="max-h-[32rem] w-auto max-w-full object-contain border border-dim/40 pointer-events-none"
                                />
                              </button>
                            )}
                            <figcaption className="text-dim text-xs mt-1">{img.caption}</figcaption>
                          </figure>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </Frame>
            )}
          </div>
        ))}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.caption}
          onClick={() => setLightbox(null)}
          className="chat-lightbox-backdrop fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={lightboxImgRef}
            src={lightbox.url}
            alt={lightbox.caption}
            draggable={false}
            onPointerDown={lightboxPointerDown}
            onPointerMove={lightboxPointerMove}
            onPointerUp={lightboxPointerUp}
            onPointerCancel={lightboxPointerUp}
            onClick={lightboxImageClick}
            className={`chat-lightbox-image max-h-[85vh] max-w-full object-contain border border-dim touch-none select-none ${
              dragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          />
          {lightbox.caption && <p className="text-dim text-sm">{lightbox.caption}</p>}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            className="text-ghost hover:text-terminal transition-colors text-xs"
          >
            [ close ]
          </button>
        </div>
      )}
    </div>
  );
}
