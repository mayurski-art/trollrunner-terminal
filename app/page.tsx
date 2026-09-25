"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import {
  centeredPopoutPos,
  clampPopoutPos,
  getDesktopServerSnapshot,
  getDesktopSnapshot,
  subscribeDesktop,
} from "@/lib/popout";
import Nav from "@/components/Nav";
import Frame from "@/components/Frame";
import Chat from "@/components/Chat";
import MiniConnector from "@/components/MiniConnector";
import SiteTicker from "@/components/SiteTicker";
import BuyTruths from "@/components/BuyTruths";
import PostGuess from "@/components/PostGuess";
import OwnerClueReveal from "@/components/OwnerClueReveal";
import GenerateTransmission from "@/components/GenerateTransmission";
import CrypticWait from "@/components/CrypticWait";
import ArchiveOfTheDay from "@/components/ArchiveOfTheDay";
import Faq from "@/components/Faq";
import { timeAgo } from "@/lib/time";
import { renderTightLines } from "@/lib/renderText";

type Post = {
  id: string;
  content: string;
  x_post_url: string | null;
  art_url: string | null;
  posted_at: string;
};

// Fixed small size for every transmission — the panel's own scroll
// (bodyClassName="chat-scroll lg:overflow-y-auto" on the Frame) already
// handles a post too long to fit, so there's no need to vary this by
// content length.
const TRANSMISSION_FONT_PX = 11;

function TransmissionText({ content, justRevealed }: { content: string; justRevealed: boolean }) {
  return (
    <p
      className={`leading-snug text-terminal font-transmission ${justRevealed ? "gt-reveal" : ""}`}
      style={{ fontSize: `${TRANSMISSION_FONT_PX}px` }}
    >
      {renderTightLines(content)}
    </p>
  );
}

// Popped-out chat's desktop (lg+) size. Sized generously (rather than the
// old 768x605) so the message list and the input box are both visible
// without scrolling on a laptop-class screen, capped by lg:max-w-[95vw]
// lg:max-h-[95vh] on the Frame itself for smaller viewports. Module scope,
// not the component body — as a fresh object each render it counts as a
// changing dependency of every callback that reads it.
const POPOUT_SIZE = { width: 960, height: 720 };

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

  // top/left are viewport px (the Frame is position:fixed once popped), and
  // are draggable via the title bar (Frame's onHeaderPointerDown) — starts
  // centered each time the popout opens, then follows wherever it's dragged.
  const [popoutPos, setPopoutPos] = useState({ top: 0, left: 0 });
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; startTop: number; startLeft: number } | null>(null);
  // Mirrors Tailwind's lg breakpoint (1024px), driving the desktop-only
  // sizing/drag of the popout alongside the lg:-prefixed classes.
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot
  );

  // Opening the popout centers it; closing leaves the position alone so it
  // isn't recomputed on the way out. Centering happens here rather than in
  // an effect so the panel is placed in the same render that shows it.
  const toggleChatPopped = useCallback(() => {
    setChatPopped((wasPopped) => {
      if (!wasPopped) setPopoutPos(centeredPopoutPos(POPOUT_SIZE));
      return !wasPopped;
    });
  }, []);

  // A popped panel that was dragged near an edge can end up off-screen when
  // the window shrinks; re-center rather than leaving it stranded.
  useEffect(() => {
    if (!chatPopped || !isDesktop) return;
    const onResize = () => setPopoutPos(centeredPopoutPos(POPOUT_SIZE));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [chatPopped, isDesktop]);

  const handlePopoutHeaderPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktop) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTop: popoutPos.top,
        startLeft: popoutPos.left,
      };
    },
    [isDesktop, popoutPos]
  );
  const handlePopoutHeaderPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setPopoutPos(
      clampPopoutPos(
        POPOUT_SIZE,
        drag.startTop + (e.clientY - drag.startY),
        drag.startLeft + (e.clientX - drag.startX)
      )
    );
  }, []);
  const handlePopoutHeaderPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragStateRef.current = null;
  }, []);

  useEffect(() => {
    if (!chatPopped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatPopped(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatPopped]);

  // The terminal page is locked from scrolling on desktop — its content
  // fits one screen there (the FAQ moved from an inline expand into its own
  // modal, so it no longer needs scroll room below the fold). Mobile stacks
  // the same content in a single column (transmission panel + chat + FAQ),
  // which routinely runs taller than the viewport, so the lock only applies
  // at the lg breakpoint and up — locking it unconditionally left phones
  // with no way to reach anything below the fold. Locking BOTH html and
  // body is required — body alone leaves html itself independently
  // scrollable, since html has no explicit overflow-y rule of its own and
  // defaults to auto regardless of what body's overflow is set to.
  // Skipped entirely when embedded in the trollrunner.net desktop shell's
  // windowed iframe: that window is a fixed-height box shorter than this
  // page's content, so the lock (tuned for a real full-height browser tab)
  // just clips the bottom of the page there with no way to reach it —
  // standalone terminal.trollrunner.net is unaffected, since window.top
  // there is the same window as window.self.
  useEffect(() => {
    if (window.self !== window.top) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const apply = (locked: boolean) => {
      document.body.style.overflow = locked ? "hidden" : prevBodyOverflow;
      document.documentElement.style.overflow = locked ? "hidden" : prevHtmlOverflow;
    };
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

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
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14 lg:py-8 lg:h-dvh">
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      {/* Desktop: this column fills the viewport and the panel row below
          takes whatever height is left, so the chat grows with the screen
          instead of sitting at a fixed height. */}
      <div className="w-full max-w-7xl lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <Nav />
        <div className="max-w-xl lg:max-w-2xl mx-auto w-full mt-3 mb-4">
          <MiniConnector variant="header" />
        </div>
        {/* relative z-[1]: lifts it above the fixed .home-hero-bg-frame,
            which otherwise paints over non-positioned content like this. */}
        <p className="relative z-[1] text-terminal text-[8px] lg:text-[0.75rem] tracking-wide mb-1 text-center">
          explore the infinite knowledge behind trolling
        </p>
        {/* Sits between the tagline and the ticker so it lands in the same
            eyeline as the $TRUTHS quote the ticker scrolls — the price and
            the way to buy it read as one beat. */}
        <div className="w-full mb-3">
          <BuyTruths />
        </div>
        <SiteTicker />

        <div className="flex flex-col lg:flex-row gap-6 mb-6 mt-6 lg:mb-0 lg:flex-1 lg:min-h-[34rem]">
          <div className="order-2 lg:order-none lg:w-1/3 flex flex-col lg:min-h-0">
            <Frame
              title="latest transmission"
              tone="terminal"
              // Desktop pins the whole left column to the row height (which
              // fills the viewport, 34rem minimum, matching the chat Frame
              // beside it) and lets this panel be the
              // part that shrinks: min-h-0 lets it drop below its content
              // height so the controls Frame under it is never pushed off the
              // page — which matters because the page itself is scroll-locked
              // at lg+, so anything past the fold there is unreachable. A
              // pending review card (GenerateTransmission) is what routinely
              // makes this panel taller than the row.
              className="lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:max-h-none"
              bodyClassName="chat-scroll lg:flex-1 lg:min-h-0 lg:overflow-y-auto"
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
                  <TransmissionText content={latest.content} justRevealed={justGenerated} />
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
              <Frame tone="dim" className="mt-3 min-w-0 lg:shrink-0" bodyClassName="py-2 min-w-0 overflow-hidden">
                <div ref={statusPortalRef} className="mb-2 min-w-0" />
                <div ref={controlsPortalRef} className="min-w-0" />
              </Frame>
            )}

            {/* Desktop moves this footer to a fixed bottom-right corner
                (below) so it stays clear of the taller node-system art;
                mobile keeps it inline here since there's no separate corner
                to pin it to in the stacked layout. */}
            <p className="lg:hidden relative z-[1] text-foreground text-sm mt-8 text-center [text-shadow:0_1px_3px_var(--background)]">
              part of the{" "}
              <a
                href="https://trollrunner.net?enter=1"
                className="glow-loop underline decoration-dim underline-offset-4"
              >
                trollrunner.net
              </a>{" "}
              network
            </p>
            <div className="lg:hidden">
              <Faq />
            </div>
          </div>

          <Frame
            title="speak to it"
            tone="dim"
            className={
              chatPopped
                ? // Mobile insets are intentionally asymmetric (more room on the
                  // right/bottom than left/top) rather than the even inset-4 —
                  // that centered box, but sat a bit low and right of true
                  // center on an iPhone 13 Pro, so it's nudged left and up.
                  "fixed top-3 left-3 right-5 bottom-5 z-50 lg:inset-auto lg:top-auto lg:left-auto lg:right-auto lg:bottom-auto lg:w-auto lg:max-w-[95vw] lg:max-h-[95vh] flex flex-col chat-popout-in"
                : `order-1 lg:order-none lg:w-2/3 lg:h-auto lg:max-h-none ${
                    session ? "h-[85dvh] max-h-[52rem]" : "h-48"
                  }`
            }
            style={
              chatPopped && isDesktop
                ? {
                    top: `${popoutPos.top}px`,
                    left: `${popoutPos.left}px`,
                    width: `${POPOUT_SIZE.width}px`,
                    height: `${POPOUT_SIZE.height}px`,
                    right: "auto",
                    bottom: "auto",
                  }
                : undefined
            }
            bodyClassName={`flex flex-col h-full ${chatPopped ? "flex-1 min-h-0" : ""}`}
            titleEffect="trace"
            traceHue="#b26bff"
            cornerAction={session ? <div ref={popoutPortalRef} /> : undefined}
            onHeaderPointerDown={chatPopped && isDesktop ? handlePopoutHeaderPointerDown : undefined}
            onHeaderPointerMove={chatPopped && isDesktop ? handlePopoutHeaderPointerMove : undefined}
            onHeaderPointerUp={chatPopped && isDesktop ? handlePopoutHeaderPointerUp : undefined}
          >
            {session ? (
              <Chat
                onSteerTransmission={hasDraft ? handleSteer : undefined}
                popped={chatPopped}
                onTogglePopout={toggleChatPopped}
                controlsPortalEl={controlsPortalEl}
                statusPortalEl={statusPortalEl}
                popoutPortalEl={popoutPortalEl}
              />
            ) : (
              <p className="text-dim text-sm flex-1 flex items-center justify-center text-center">
                sign in up top to chat with it
              </p>
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

        <div className="hidden lg:flex flex-col items-end fixed bottom-4 right-4 z-[1]">
          <p className="text-foreground text-base text-right [text-shadow:0_1px_3px_var(--background)]">
            part of the{" "}
            <a
              href="https://trollrunner.net?enter=1"
              className="glow-loop underline decoration-dim underline-offset-4"
            >
              trollrunner.net
            </a>{" "}
            network
          </p>
          <Faq />
        </div>
      </div>

      {/* Hidden while the chat popout is up: that panel is a focused modal
          with its own backdrop, and a spotlight sliding in over it would
          both overlap the popout and sit under its z-40 scrim. */}
      {!chatPopped && <ArchiveOfTheDay />}
    </main>
  );
}
