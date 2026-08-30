"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import { BANNER_LOGS } from "@/lib/ascii";
import { timeAgo } from "@/lib/time";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  art_url: string | null;
  posted_at: string;
};

// The broadcast persona's two signature marks (see CHAT/SYSTEM prompts in
// lib/persona.ts) — used sparingly, so most posts carry neither and fall
// into "unmarked." Classifying client-side off the raw content means this
// stays in sync automatically if the marks ever change wording, no schema
// change needed.
type Kind = "clue" | "musing" | "unmarked";

const KIND_META: Record<Kind, { label: string; mark: string }> = {
  clue: { label: "clues", mark: "▚▞" },
  musing: { label: "musings", mark: "▓▒▓" },
  unmarked: { label: "unmarked", mark: "" },
};

function classify(content: string): Kind {
  if (content.includes("▚▞")) return "clue";
  if (content.includes("▓▒▓")) return "musing";
  return "unmarked";
}

export default function LogsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Kind | "all">("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setPosts(data.posts ?? []);
      })
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      <div className="w-full max-w-2xl">
        <Nav />
        <Banner art={BANNER_LOGS} label="the logs" />
        <p className="text-dim text-sm mb-8">the full transmission archive</p>

        {posts && posts.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs">
            {(["all", "clue", "musing", "unmarked"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                aria-pressed={filter === k}
                className={`border px-2 py-1 transition-colors ${
                  filter === k
                    ? "border-terminal text-terminal"
                    : "border-dim text-dim hover:border-terminal hover:text-terminal"
                }`}
              >
                {k === "all" ? "[ all ]" : `[ ${KIND_META[k].mark ? KIND_META[k].mark + " " : ""}${KIND_META[k].label} ]`}
              </button>
            ))}
          </div>
        )}

        <Frame title="transmissions" tone="terminal">
          {error && <p className="text-alert text-sm">[connection error: {error}]</p>}
          {!error && posts === null && (
            <p className="text-dim text-sm animate-pulse">loading archive...</p>
          )}
          {posts && posts.length === 0 && (
            <p className="text-dim text-sm">[no transmissions yet]</p>
          )}
          {(() => {
            const filtered = posts?.filter((p) => filter === "all" || classify(p.content) === filter);
            if (posts && posts.length > 0 && filtered?.length === 0) {
              return <p className="text-dim text-sm">[no {KIND_META[filter as Kind]?.label ?? ""} transmissions yet]</p>;
            }
            return (
              <ul className="space-y-5">
                {filtered?.map((post) => {
                  const kind = classify(post.content);
                  return (
                    <li key={post.id} className="border-l-2 border-dim pl-4">
                      <p className="whitespace-pre-wrap leading-relaxed text-terminal">
                        {post.content}
                      </p>
                      {post.art_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={post.art_url}
                          alt=""
                          className="mt-3 w-full max-w-md rounded border border-dim"
                        />
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-dim">
                        <span>{timeAgo(post.posted_at)}</span>
                        {kind !== "unmarked" && (
                          <span className="text-problem">{KIND_META[kind].label}</span>
                        )}
                        {post.x_post_url && (
                          <a
                            href={post.x_post_url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-terminal underline decoration-dim underline-offset-2"
                          >
                            view on x
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </Frame>
      </div>
    </main>
  );
}
