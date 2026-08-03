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
  posted_at: string;
};

export default function LogsPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-2xl">
        <Nav />
        <Banner art={BANNER_LOGS} label="the logs" />
        <p className="text-dim text-sm mb-8">the full transmission archive</p>

        <Frame title="transmissions" tone="terminal">
          {error && <p className="text-alert text-sm">[connection error: {error}]</p>}
          {!error && posts === null && (
            <p className="text-dim text-sm animate-pulse">loading archive...</p>
          )}
          {posts && posts.length === 0 && (
            <p className="text-dim text-sm">[no transmissions yet]</p>
          )}
          <ul className="space-y-5">
            {posts?.map((post) => (
              <li key={post.id} className="border-l-2 border-dim pl-4">
                <p className="whitespace-pre-wrap leading-relaxed text-terminal">
                  {post.content}
                </p>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-dim">
                  <span>{timeAgo(post.posted_at)}</span>
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
            ))}
          </ul>
        </Frame>
      </div>
    </main>
  );
}
