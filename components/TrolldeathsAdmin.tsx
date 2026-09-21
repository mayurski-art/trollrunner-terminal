"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Frame from "@/components/Frame";
import type { TrollDeathItem, TrollDeathKind } from "@/app/trolldeaths/page";

const EMPTY_DRAFT: Partial<TrollDeathItem> = {
  kind: "fud",
  title: "",
  copy: "",
  tags: [],
  sourceHref: "",
  sourceLabel: "",
  eventDate: new Date().toISOString().slice(0, 16),
};

export default function TrolldeathsAdmin() {
  const [items, setItems] = useState<TrollDeathItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<TrollDeathItem>>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tweetUrl, setTweetUrl] = useState("");
  const [fetchingTweet, setFetchingTweet] = useState(false);

  const authedFetch = useCallback(async (init?: RequestInit, path = "/api/admin/trolldeaths") => {
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch();
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(body.error ?? "could not reach the ledger");
        else setItems(body.items ?? []);
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

  function startEdit(item: TrollDeathItem) {
    setEditingId(item.id ?? null);
    setDraft({
      ...item,
      eventDate: item.eventDate ? item.eventDate.slice(0, 16) : "",
    });
  }

  function resetForm() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setTweetUrl("");
  }

  async function fetchFromTweet() {
    if (!tweetUrl.trim()) return;
    setError(null);
    setFetchingTweet(true);
    try {
      const res = await authedFetch({
        method: "POST",
        body: JSON.stringify({ url: tweetUrl.trim() }),
      }, "/api/admin/trolldeaths/fetch-tweet");
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "could not fetch that tweet");
        return;
      }
      setDraft((d) => ({
        ...d,
        title: body.title ?? d.title,
        copy: body.copy ?? d.copy,
        tags: body.tags ?? d.tags,
        eventDate: body.eventDate ? body.eventDate.slice(0, 16) : d.eventDate,
        sourceHref: body.sourceHref ?? d.sourceHref,
        sourceLabel: body.sourceLabel ?? d.sourceLabel,
      }));
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setFetchingTweet(false);
    }
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const payload = {
        ...draft,
        id: editingId ?? undefined,
        eventDate: draft.eventDate ? new Date(draft.eventDate).toISOString() : undefined,
        tags: typeof draft.tags === "string"
          ? (draft.tags as unknown as string).split(",").map((t) => t.trim()).filter(Boolean)
          : draft.tags,
      };
      const res = await authedFetch({
        method: "POST",
        body: JSON.stringify({ action: "save", item: payload }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "that didn't take");
        return;
      }
      setItems(body.items ?? []);
      resetForm();
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this entry?")) return;
    setError(null);
    setBusy(true);
    try {
      const res = await authedFetch({
        method: "POST",
        body: JSON.stringify({ action: "delete", id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "delete failed");
        return;
      }
      setItems(body.items ?? []);
      if (editingId === id) resetForm();
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-dim text-sm animate-pulse">reading the ledger...</p>;
  }

  return (
    <div className="space-y-5">
      {error && <p className="text-alert text-xs">{error}</p>}

      <Frame title={editingId ? "edit entry" : "new entry"} tone="terminal">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="paste tweet link to auto-fill (optional)"
              value={tweetUrl}
              onChange={(e) => setTweetUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchFromTweet();
                }
              }}
              className="flex-1 bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground placeholder:text-dim focus:border-terminal outline-none"
            />
            <button
              type="button"
              disabled={fetchingTweet || !tweetUrl.trim()}
              onClick={fetchFromTweet}
              className="border border-terminal text-terminal px-3 py-1.5 text-xs hover:bg-terminal/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              [ {fetchingTweet ? "fetching..." : "fetch tweet"} ]
            </button>
          </div>

          <div className="flex gap-3 text-xs">
            {(["fud", "guardian"] as TrollDeathKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, kind: k }))}
                aria-pressed={draft.kind === k}
                className={`border px-2 py-1 transition-colors ${
                  draft.kind === k
                    ? "border-terminal text-terminal"
                    : "border-dim text-dim hover:border-terminal hover:text-terminal"
                }`}
              >
                [ {k} ]
              </button>
            ))}
          </div>

          <input
            type="text"
            placeholder="title"
            value={draft.title ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="w-full bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground placeholder:text-dim focus:border-terminal outline-none"
          />

          <textarea
            placeholder="copy"
            rows={3}
            value={draft.copy ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, copy: e.target.value }))}
            className="w-full bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground placeholder:text-dim focus:border-terminal outline-none resize-y"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="datetime-local"
              value={typeof draft.eventDate === "string" ? draft.eventDate : ""}
              onChange={(e) => setDraft((d) => ({ ...d, eventDate: e.target.value }))}
              className="w-full bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground focus:border-terminal outline-none"
            />
            <input
              type="text"
              placeholder="tags, comma, separated"
              value={Array.isArray(draft.tags) ? draft.tags.join(", ") : (draft.tags ?? "")}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value as unknown as string[] }))}
              className="w-full bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground placeholder:text-dim focus:border-terminal outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="url"
              placeholder="https://x.com/... (optional)"
              value={draft.sourceHref ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, sourceHref: e.target.value }))}
              className="w-full bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground placeholder:text-dim focus:border-terminal outline-none"
            />
            <input
              type="text"
              placeholder="source label (optional)"
              value={draft.sourceLabel ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, sourceLabel: e.target.value }))}
              className="w-full bg-transparent border border-dim px-2 py-1.5 text-sm text-foreground placeholder:text-dim focus:border-terminal outline-none"
            />
          </div>

          <div className="flex gap-3 items-center">
            <button
              type="button"
              disabled={busy || !draft.title || !draft.copy}
              onClick={submit}
              className="border border-terminal text-terminal px-3 py-1.5 text-xs hover:bg-terminal/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              [ {editingId ? "save changes" : "add entry"} ]
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-dim hover:text-terminal"
              >
                [ cancel ]
              </button>
            )}
          </div>
        </div>
      </Frame>

      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="text-dim text-xs">{items.length} total entries</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <Frame key={item.id} tone={item.kind === "guardian" ? "terminal" : "alert"}>
            <div className="flex items-center gap-2 text-xs mb-2 flex-wrap">
              <span className={item.kind === "guardian" ? "text-terminal" : "text-alert"}>
                [ {item.kind} ]
              </span>
              <span className="text-dim">{item.date}</span>
            </div>
            <p className="text-foreground text-sm font-bold mb-1">{item.title}</p>
            <p className="text-dim text-sm leading-relaxed">{item.copy}</p>
            <div className="mt-3 flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="text-dim hover:text-terminal"
              >
                [ edit ]
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => item.id && remove(item.id)}
                className="text-dim hover:text-alert disabled:opacity-40"
              >
                [ delete ]
              </button>
            </div>
          </Frame>
        ))}
      </div>
    </div>
  );
}
