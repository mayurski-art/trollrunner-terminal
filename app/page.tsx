"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import GenerateTransmission from "@/components/GenerateTransmission";
import CrypticWait from "@/components/CrypticWait";
import Faq from "@/components/Faq";
import { BANNER_TROLLFACE, BANNER_TROLLFACE_WIDE } from "@/lib/ascii";
import { timeAgo } from "@/lib/time";
import { renderTightLines } from "@/lib/renderText";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  art_url: string | null;
  posted_at: string;
};

// The "latest transmission" panel is a fixed height (matches the chat
// panel next to it), so a short post left a lot of empty space below the
// guess prompt while a long one needed scrolling. Scaling the text size to
// content length fills the panel either way instead of leaving it fixed
// at one size no post actually fits well. Bucketed on length rather than a
// live ResizeObserver — the content only ever changes on a fresh fetch/
// generate, never while mid-render.
function transmissionTextSize(content: string): string {
  const len = content.length;
  if (len <= 80) return "text-3xl";
  if (len <= 140) return "text-2xl";
  if (len <= 200) return "text-xl";
  if (len <= 280) return "text-base";
  return "text-sm";
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [latest, setLatest] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justGenerated, setJustGenerated] = useState(false);
  // True while a transmission is being generated — the panel shows the cryptic
  // waiting animation in place of the current transmission text.
  const [generating, setGenerating] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [chatPopped, setChatPopped] = useState(false);
  const steerRef = useRef<((note: string) => void) | null>(null);
  // A ref callback (not a plain useRef) so Chat re-renders once this div
  // actually mounts — a bare ref's .current change wouldn't trigger that,
  // and the portal target is null on Chat's very first render otherwise.
  const [controlsPortalEl, setControlsPortalEl] = useState<HTMLDivElement | null>(null);
  const controlsPortalRef = useCallback((el: HTMLDivElement | null) => {
    setControlsPortalEl(el);
  }, []);
  // Status row (face/mining/buddy) portals into the same controls box,
  // freeing the space it used to take above the transcript in "speak to it".
  const [statusPortalEl, setStatusPortalEl] = useState<HTMLDivElement | null>(null);
  const statusPortalRef = useCallback((el: HTMLDivElement | null) => {
    setStatusPortalEl(el);
  }, []);
  // Pop-out toggle portals into the "speak to it" Frame's own top-right
  // corner via Frame's cornerAction, rather than living in the controls box.
  const [popoutPortalEl, setPopoutPortalEl] = useState<HTMLDivElement | null>(null);
  const popoutPortalRef = useCallback((el: HTMLDivElement | null) => {
    setPopoutPortalEl(el);
  }, []);

  // Popped-out chat's desktop (lg+) position/size, hand-picked via a
  // temporary drag/resize rig and locked in here. Mobile keeps the simple
  // full-inset popout untouched.
  const POPOUT_BOX = { top: -137, left: -118, width: 768, height: 605 };
  // Mirrors Tailwind's lg breakpoint (1024px) so the inline positioning
  // style only overrides the fixed/inset-4 classes on desktop, matching
  // the lg:-prefixed classes it's meant to sit alongside.
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!chatPopped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatPopped(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatPopped]);

  // The popout sits at a fixed position that can extend past the
  // viewport's natural bounds (it's deliberately offset off-screen at the
  // top-left), which was growing the page's own scrollable area and
  // showing a second scrollbar behind the popout's overlay. Locking scroll
  // on BOTH html and body while popped is required — body alone left html
  // itself still independently scrollable (it has no explicit overflow-y
  // rule, so it defaults to auto regardless of body's own overflow), which
  // is what let the page keep scrolling behind the popout.
  useEffect(() => {
    if (!chatPopped) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [chatPopped]);

  const handleSteer = useCallback((note: string) => {
    steerRef.current?.(note);
  }, []);

  const handleReviewChange = useCallback((post: Post | null) => {
    setHasDraft(post !== null);
  }, []);

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
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      <div className="w-full max-w-7xl">
        <Nav />
        <div className="max-w-md md:max-w-2xl mx-auto mb-2">
          <Banner
            art={BANNER_TROLLFACE}
            wideArt={BANNER_TROLLFACE_WIDE}
            label="trolltruths terminal"
            maxFontPx={9}
            wideMaxFontPx={14}
          />
        </div>
        <p className="text-terminal text-[8px] tracking-wide mb-1 text-center">
          explore the infinite knowledge behind trolling
        </p>
        <SiteTicker />

        <div className="flex flex-col lg:flex-row gap-6 mb-6 mt-6">
          <div className="order-2 lg:order-none lg:w-1/3 flex flex-col">
            <Frame
              title="latest transmission"
              tone="terminal"
              className="lg:max-h-[34rem]"
              bodyClassName="chat-scroll lg:overflow-y-auto"
              titleEffect="trace"
              traceHue="#2ee6ff"
            >
              <GenerateTransmission
                session={session}
                onPendingChange={setGenerating}
                onReviewChange={handleReviewChange}
                steerRef={steerRef}
                onGenerated={(post) => {
                  setLatest(post);
                  setJustGenerated(true);
                  setTimeout(() => setJustGenerated(false), 1200);
                }}
              />
              {error && <p className="text-alert text-sm">[connection error: {error}]</p>}
              {!error && !latest && !generating && (
                <p className="text-dim text-sm animate-pulse">establishing connection...</p>
              )}
              {generating && <CrypticWait />}
              {latest && !generating && (
                <>
                  <p
                    className={`leading-snug text-terminal ${transmissionTextSize(latest.content)} ${
                      justGenerated ? "gt-reveal" : ""
                    }`}
                  >
                    {renderTightLines(latest.content)}
                  </p>
                  {latest.art_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={latest.art_url}
                      alt=""
                      className="mt-2 w-full rounded border border-dim"
                    />
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-dim">
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

            {session && (
              // Chat.tsx still owns all the actual voice/clear/pop-out state
              // and logic (it's the component with the messages and speech
              // synthesis) — it portals its controls UI into this div
              // rather than page.tsx duplicating that logic to render a
              // second copy. Fills the empty space that used to sit below
              // the guess prompt on a short transmission.
              <Frame tone="dim" className="mt-3 min-w-0" bodyClassName="py-2 min-w-0 overflow-hidden">
                <div ref={statusPortalRef} className="mb-2 min-w-0" />
                <div ref={controlsPortalRef} className="min-w-0" />
              </Frame>
            )}
          </div>

          <Frame
            title="speak to it"
            tone="dim"
            className={
              chatPopped
                ? "fixed inset-4 z-50 lg:inset-auto lg:w-auto lg:max-w-[95vw] lg:max-h-[95vh] flex flex-col chat-popout-in"
                : `order-1 lg:order-none lg:w-2/3 lg:h-[34rem] lg:max-h-none ${
                    session ? "h-[80vh] max-h-[42rem]" : "h-auto"
                  }`
            }
            style={
              chatPopped && isDesktop
                ? {
                    top: `${POPOUT_BOX.top}px`,
                    left: `${POPOUT_BOX.left}px`,
                    width: `${POPOUT_BOX.width}px`,
                    height: `${POPOUT_BOX.height}px`,
                    right: "auto",
                    bottom: "auto",
                  }
                : undefined
            }
            bodyClassName={`flex flex-col ${session || chatPopped ? "h-full" : ""} ${
              chatPopped ? "flex-1 min-h-0" : ""
            }`}
            titleEffect="trace"
            traceHue="#b26bff"
            cornerAction={session ? <div ref={popoutPortalRef} /> : undefined}
          >
            <div className="shrink-0 max-w-xl mx-auto w-full">
              <MiniConnector />
            </div>
            {session ? (
              <Chat
                onSteerTransmission={hasDraft ? handleSteer : undefined}
                popped={chatPopped}
                onTogglePopout={() => setChatPopped((v) => !v)}
                controlsPortalEl={controlsPortalEl}
                statusPortalEl={statusPortalEl}
                popoutPortalEl={popoutPortalEl}
              />
            ) : (
              <p className="text-dim text-sm">sign in up top to chat with it</p>
            )}
          </Frame>

          {chatPopped && (
            <div
              className="fixed inset-0 z-40 bg-background/90"
              onClick={() => setChatPopped(false)}
              aria-hidden="true"
            />
          )}
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
        <Faq />
      </div>
    </main>
  );
}
