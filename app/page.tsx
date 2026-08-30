"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import Chat from "@/components/Chat";
import MiniConnector from "@/components/MiniConnector";
import SiteTicker from "@/components/SiteTicker";
import PostGuess from "@/components/PostGuess";
import OwnerClueReveal from "@/components/OwnerClueReveal";
import { BANNER_TROLLFACE } from "@/lib/ascii";
import { timeAgo } from "@/lib/time";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  art_url: string | null;
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
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="home-hero-bg-frame w-full max-w-7xl" aria-hidden="true">
        <div className="home-hero-bg" />
        <div className="home-hero-bg home-hero-bg--sharpen" />
      </div>
      <div className="w-full max-w-7xl">
        <Nav />
        <div className="max-w-md mx-auto mb-2">
          <Banner art={BANNER_TROLLFACE} label="trollface terminal" maxFontPx={9} />
        </div>
        <p className="glow-loop text-base sm:text-lg font-extrabold tracking-wide mb-1 text-center">
          explore the infinite knowledge behind trolling
        </p>
        <SiteTicker />

        <div className="flex flex-col lg:flex-row gap-6 mb-6 mt-6">
          <Frame
            title="latest transmission"
            tone="terminal"
            className="order-2 lg:order-none lg:w-1/3 lg:h-[34rem]"
            bodyClassName="chat-scroll lg:h-full lg:overflow-y-auto"
            titleEffect="trace"
            traceHue="#2ee6ff"
          >
            {error && <p className="text-alert text-sm">[connection error: {error}]</p>}
            {!error && !latest && (
              <p className="text-dim text-sm animate-pulse">establishing connection...</p>
            )}
            {latest && (
              <>
                <p className="whitespace-pre-wrap leading-relaxed text-terminal">
                  {latest.content}
                </p>
                {latest.art_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={latest.art_url}
                    alt=""
                    className="mt-3 w-full rounded border border-dim"
                  />
                )}
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
                <OwnerClueReveal session={session} />
                <PostGuess postId={latest.id} session={session} />
              </>
            )}
          </Frame>

          <Frame
            title="speak to it"
            tone="dim"
            className={`order-1 lg:order-none lg:w-2/3 lg:h-[34rem] lg:max-h-none ${
              session ? "h-[80vh] max-h-[42rem]" : "h-auto"
            }`}
            bodyClassName={`flex flex-col ${session ? "h-full" : ""}`}
            titleEffect="trace"
            traceHue="#b26bff"
          >
            <div className="shrink-0">
              <MiniConnector />
            </div>
            {session ? (
              <Chat />
            ) : (
              <p className="text-dim text-sm">sign in up top to chat with it</p>
            )}
          </Frame>
        </div>

        <p className="relative z-[1] text-foreground text-xs mt-8 text-center [text-shadow:0_1px_3px_var(--background)]">
          part of the{" "}
          <a
            href="https://trollrunner.net?enter=1"
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
