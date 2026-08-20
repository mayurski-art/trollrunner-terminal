"use client";

import { useCallback, useEffect, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { artPrompt } from "@/lib/artStyle";
import { timeAgo } from "@/lib/time";
import Frame from "@/components/Frame";

type Post = {
  id: string;
  content: string;
  clue_tag: string | null;
  x_post_url: string | null;
  art_url: string | null;
  posted_at: string;
};

// Posting to X is manual — X gates write access behind a paid tier — so this
// panel exists to make "manual" cost one tap instead of six steps. The whole
// flow is client-side link-building plus two column writes; it never calls
// the Claude API, which is why it stays useful while the terminal is paused.
export default function Transmit() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPosted, setShowPosted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const authedFetch = useCallback(async (init?: RequestInit) => {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return fetch("/api/admin/transmissions", {
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
        if (!res.ok) setError(body.error ?? "could not reach the wire");
        else setPosts(body.posts ?? []);
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

  async function update(id: string, action: "mark_posted" | "set_art", url: string | null) {
    setError(null);
    try {
      const res = await authedFetch({
        method: "POST",
        body: JSON.stringify({ action, id, url }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "that didn't take");
        return false;
      }
      setPosts((prev) => prev.map((p) => (p.id === id ? body.post : p)));
      return true;
    } catch {
      setError("connection to the terminal was lost");
      return false;
    }
  }

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1800);
    } catch {
      setError("clipboard refused — copy it by hand");
    }
  }

  if (loading) {
    return <p className="text-dim text-sm animate-pulse">reading the wire...</p>;
  }

  const untransmitted = posts.filter((p) => !p.x_post_url);
  const visible = showPosted ? posts : untransmitted;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="text-problem text-sm">
          ▣ {untransmitted.length} untransmitted
          <span className="text-dim"> · {posts.length} total</span>
        </p>
        <button
          type="button"
          onClick={() => setShowPosted((v) => !v)}
          className="text-xs text-dim hover:text-terminal"
        >
          [ {showPosted ? "hide" : "show"} already posted ]
        </button>
      </div>

      {error && <p className="text-alert text-xs">{error}</p>}

      {visible.length === 0 && (
        <p className="text-dim text-sm">
          nothing waiting. the wire is quiet.
        </p>
      )}

      {visible.map((post) => (
        <TransmitRow
          key={post.id}
          post={post}
          copied={copied}
          onCopy={copy}
          onUpdate={update}
        />
      ))}
    </div>
  );
}

function TransmitRow({
  post,
  copied,
  onCopy,
  onUpdate,
}: {
  post: Post;
  copied: string | null;
  onCopy: (text: string, tag: string) => void;
  onUpdate: (id: string, action: "mark_posted" | "set_art", url: string | null) => Promise<boolean>;
}) {
  const [statusUrl, setStatusUrl] = useState("");
  const [artUrl, setArtUrl] = useState("");
  const [subject, setSubject] = useState(post.clue_tag ?? "");
  const [busy, setBusy] = useState(false);

  const posted = Boolean(post.x_post_url);
  const intent = `https://x.com/intent/post?text=${encodeURIComponent(post.content)}`;

  async function submit(action: "mark_posted" | "set_art", value: string) {
    setBusy(true);
    const ok = await onUpdate(post.id, action, value);
    if (ok) {
      if (action === "mark_posted") setStatusUrl("");
      else setArtUrl("");
    }
    setBusy(false);
  }

  return (
    <Frame tone={posted ? "dim" : "terminal"}>
      <div className="flex items-center gap-3 text-xs text-dim mb-2 flex-wrap">
        <span>{timeAgo(post.posted_at)}</span>
        <span>·</span>
        <span>{post.content.length}/280</span>
        {posted ? (
          <span className="text-terminal">▣ posted</span>
        ) : (
          <span className="text-problem">▨ waiting</span>
        )}
        {post.clue_tag && (
          <span className="text-blue-400">clue: {post.clue_tag}</span>
        )}
      </div>

      <p className="whitespace-pre-wrap leading-relaxed text-terminal text-sm">
        {post.content}
      </p>

      {post.art_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.art_url}
          alt=""
          className="mt-3 w-full max-w-xs rounded border border-dim"
        />
      )}

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        <a
          href={intent}
          target="_blank"
          rel="noopener noreferrer"
          className="text-terminal hover:text-problem"
        >
          [ post to X ]
        </a>
        <button
          type="button"
          onClick={() => onCopy(post.content, `text-${post.id}`)}
          className="text-dim hover:text-terminal"
        >
          [ {copied === `text-${post.id}` ? "copied" : "copy text"} ]
        </button>
        <button
          type="button"
          onClick={() => onCopy(artPrompt(subject || "the grin, alone"), `art-${post.id}`)}
          className="text-dim hover:text-terminal"
        >
          [ {copied === `art-${post.id}` ? "copied" : "copy art prompt"} ]
        </button>
        {posted && (
          <a
            href={post.x_post_url!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-dim hover:text-terminal"
          >
            [ view on X ]
          </a>
        )}
      </div>

      {!post.clue_tag && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="art subject (no clue recorded — type one)"
          className="mt-3 w-full bg-transparent border border-dim px-2 py-1 text-xs text-foreground placeholder:text-ghost focus:border-terminal focus:outline-none"
        />
      )}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (statusUrl.trim()) submit("mark_posted", statusUrl);
          }}
          className="flex gap-2"
        >
          <input
            value={statusUrl}
            onChange={(e) => setStatusUrl(e.target.value)}
            placeholder={posted ? "replace status url" : "paste x.com status url"}
            className="flex-1 min-w-0 bg-transparent border border-dim px-2 py-1 text-xs text-foreground placeholder:text-ghost focus:border-terminal focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !statusUrl.trim()}
            className="text-xs text-dim hover:text-terminal disabled:opacity-40 whitespace-nowrap"
          >
            [ mark posted ]
          </button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (artUrl.trim()) submit("set_art", artUrl);
          }}
          className="flex gap-2"
        >
          <input
            value={artUrl}
            onChange={(e) => setArtUrl(e.target.value)}
            placeholder={post.art_url ? "replace art url" : "paste art url"}
            className="flex-1 min-w-0 bg-transparent border border-dim px-2 py-1 text-xs text-foreground placeholder:text-ghost focus:border-terminal focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !artUrl.trim()}
            className="text-xs text-dim hover:text-terminal disabled:opacity-40 whitespace-nowrap"
          >
            [ attach art ]
          </button>
        </form>
      </div>
    </Frame>
  );
}
