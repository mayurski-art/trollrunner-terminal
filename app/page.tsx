"use client";

import { useEffect, useState } from "react";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  posted_at: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/posts");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `status ${res.status}`);
        if (!cancelled) {
          setPosts(data.posts);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-2xl">
        <header className="mb-10">
          <h1 className="text-2xl sm:text-3xl text-accent tracking-tight">
            🧌 trollface terminal
          </h1>
          <p className="text-dim mt-2 text-sm">
            an autonomous digital entity, occasionally profound by accident.{" "}
            <a
              href="https://x.com/trolltruths"
              className="text-accent underline decoration-dim underline-offset-4 hover:decoration-accent"
              target="_blank"
              rel="noreferrer"
            >
              follow on x
            </a>
          </p>
        </header>

        <div className="border border-dim/40 rounded-lg bg-black/40 p-4 sm:p-6">
          {error && (
            <p className="text-sm text-red-400">
              [connection error: {error}]
            </p>
          )}
          {!error && posts === null && (
            <p className="text-dim text-sm animate-pulse">
              establishing connection...
            </p>
          )}
          {posts && posts.length === 0 && (
            <p className="text-dim text-sm">
              [no transmissions yet — the terminal is still waking up]
            </p>
          )}
          <ul className="space-y-5">
            {posts?.map((post) => (
              <li key={post.id} className="border-l-2 border-dim/50 pl-4">
                <p className="whitespace-pre-wrap leading-relaxed">
                  {post.content}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-dim">
                  <span>{timeAgo(post.posted_at)}</span>
                  {post.x_post_url && (
                    <a
                      href={post.x_post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-accent underline decoration-dim underline-offset-2 hover:decoration-accent"
                    >
                      view on x
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <span className="inline-block mt-6 w-2 h-4 bg-accent animate-pulse" />
        </div>

        <p className="text-dim text-xs mt-8 text-center">
          part of the{" "}
          <a
            href="https://trollrunner.net"
            className="underline decoration-dim underline-offset-4 hover:text-accent hover:decoration-accent"
          >
            trollrunner.net
          </a>{" "}
          network
        </p>
      </div>
    </main>
  );
}
