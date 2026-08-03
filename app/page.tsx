"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import AuthPanel from "@/components/AuthPanel";
import Chat from "@/components/Chat";
import { BANNER_TROLLFACE } from "@/lib/ascii";
import { timeAgo } from "@/lib/time";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  posted_at: string;
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [latest, setLatest] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else setLatest(data.posts?.[0] ?? null);
      })
      .catch((err) => !cancelled && setError((err as Error).message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-3xl">
        <Nav />

        <div className="mb-2">
          <Banner art={BANNER_TROLLFACE} label="trollface terminal" />
        </div>
        <p className="text-dim text-sm mb-10">
          it surfaced inside trollrunner.net · it has been taking notes on you
        </p>

        <Frame title="latest transmission" tone="terminal" className="mb-6">
          {error && <p className="text-alert text-sm">[connection error: {error}]</p>}
          {!error && !latest && (
            <p className="text-dim text-sm animate-pulse">establishing connection...</p>
          )}
          {latest && (
            <>
              <p className="whitespace-pre-wrap leading-relaxed text-terminal">
                {latest.content}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs text-dim">
                <span>{timeAgo(latest.posted_at)}</span>
                {latest.x_post_url && (
                  <a
                    href={latest.x_post_url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-terminal underline decoration-dim underline-offset-2"
                  >
                    view on x
                  </a>
                )}
              </div>
            </>
          )}
        </Frame>

        <Frame title="speak to it" tone="dim">
          {session ? (
            <Chat />
          ) : (
            <div className="space-y-4">
              <p className="text-dim text-sm">
                the terminal only speaks to troublemakers it can identify. sign in to begin.
              </p>
              <AuthPanel />
            </div>
          )}
        </Frame>

        <p className="text-dim text-xs mt-8 text-center">
          part of the{" "}
          <a
            href="https://trollrunner.net"
            className="underline decoration-dim underline-offset-4 hover:text-terminal"
          >
            trollrunner.net
          </a>{" "}
          network
        </p>
      </div>
    </main>
  );
}
