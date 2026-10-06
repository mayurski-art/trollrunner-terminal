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
import PostGuess from "@/components/PostGuess";
import OwnerClueReveal from "@/components/OwnerClueReveal";
import GenerateTransmission from "@/components/GenerateTransmission";
import CrypticWait from "@/components/CrypticWait";
import ArchiveOfTheDay from "@/components/ArchiveOfTheDay";
import NewestFile from "@/components/NewestFile";
import type { Post } from "@/app/logs/page";
import { timeAgo } from "@/lib/time";
import { renderTightLines } from "@/lib/renderText";

// Fixed small size for every transmission — the panel's own scroll
// (bodyClassName="chat-scroll lg:overflow-y-auto" on the Frame) already
// handles a post too long to fit, so there's no need to vary this by
// content length.
// 11px on a laptop (0.92rem of the 12px root floor), growing with the root
// font-size on bigger monitors instead of sitting tiny in a large panel.
const TRANSMISSION_FONT_SIZE = "max(11px, 0.92rem)";

// Popped out, the panel has room to read at the logs modal's size instead.
function TransmissionText({
  content,
  justRevealed,
  popped,
}: {
  content: string;
  justRevealed: boolean;
  popped: boolean;
}) {
  return (
    <p
      className={`text-terminal font-transmission ${
        popped ? "text-lg sm:text-xl lg:text-2xl leading-relaxed" : "leading-snug"
      } ${justRevealed ? "gt-reveal" : ""}`}
      style={popped ? undefined : { fontSize: TRANSMISSION_FONT_SIZE }}
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
  // Pops the whole "latest transmission" Frame out the same way the chat
  // does (not the logs grid's read-only modal), so the admin's generate /
  // edit controls in GenerateTransmission come along with it. Only one of
  // the two panels is ever popped, so they share the position/drag state.
  const [transmissionPopped, setTransmissionPopped] = useState(false);
  const anyPopped = chatPopped || transmissionPopped;
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
  const toggleTransmissionPopped = useCallback(() => {
    setTransmissionPopped((wasPopped) => {
      if (!wasPopped) setPopoutPos(centeredPopoutPos(POPOUT_SIZE));
      return !wasPopped;
    });
  }, []);
  const closePopouts = useCallback(() => {
    setChatPopped(false);
    setTransmissionPopped(false);
  }, []);

  // A popped panel that was dragged near an edge can end up off-screen when
  // the window shrinks; re-center rather than leaving it stranded.
  useEffect(() => {
    if (!anyPopped || !isDesktop) return;
    const onResize = () => setPopoutPos(centeredPopoutPos(POPOUT_SIZE));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [anyPopped, isDesktop]);

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
    if (!anyPopped) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopouts();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyPopped, closePopouts]);

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
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14 lg:py-8 short:py-3 lg:h-dvh">
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      {/* Desktop: this column fills the viewport and the panel row below
          takes whatever height is left, so the chat grows with the screen
          instead of sitting at a fixed height. */}
      {/* Width tracks the screen on desktop instead of stopping at a fixed
          80rem: that cap left a 1366 laptop only 70% of its width and a
          3440 ultrawide 44%. 90vw, floored at the old 80rem and capped at
          120rem so chat lines never stretch unreadably long. */}
      <div className="w-full max-w-7xl lg:max-w-[max(80rem,min(90vw,120rem))] lg:flex-1 lg:min-h-0 lg:flex lg:flex-col">
        <Nav />
        {/* Desktop header band: the node system on the left, everything else
            that used to stack under it (tagline, buy row, ticker, network
            badge) in a column beside it. Stacked, those rows cost roughly a
            third of a laptop's height before the panels even started; side
            by side they fit inside the node system's own height. Phones keep
            the original stacked order. */}
        <div className="mt-3 mb-6 short:mt-1 short:mb-3 lg:flex lg:items-center lg:gap-8">
          <div className="max-w-xl lg:max-w-none mx-auto w-full lg:mx-0 lg:w-[36rem] lg:px-[1.8rem] lg:shrink-0">
            <MiniConnector variant="header" />
          </div>
          <div className="mt-4 lg:mt-0 lg:flex-1 lg:min-w-0 flex flex-col gap-2">
            <NewestFile />
            {/* relative z-[1]: lifts it above the fixed .home-hero-bg-frame,
                which otherwise paints over non-positioned content like this. */}
            <div className="relative z-[1] flex items-baseline justify-center lg:justify-between gap-x-4 flex-wrap">
              <p className="text-terminal text-[8px] lg:text-[0.875rem] tracking-wide text-center lg:text-left">
                explore the infinite knowledge behind trolling
              </p>
            </div>
            <SiteTicker />
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 mb-6 lg:mb-0 lg:flex-1 lg:min-h-[34rem] short:min-h-[26rem]">
          <div className="order-2 lg:order-none lg:w-1/3 flex flex-col lg:min-h-0">
            <Frame
              title="latest transmission"
              tone="terminal"
              // Desktop pins the whole left column to the row height (which
              // fills the viewport, 34rem minimum, matching the chat Frame
              // beside it) and lets this panel be the
              // part that shrinks: min-h-0 lets it drop below its content
              // height so the controls Frame under it is never pushed off the
              // page. A pending review card (GenerateTransmission) is what
              // routinely makes this panel taller than the row.
              // Popped: same fixed, centered, draggable box as the chat.
              className={
                transmissionPopped
                  ? "fixed top-3 left-3 right-5 bottom-5 z-50 lg:inset-auto lg:top-auto lg:left-auto lg:right-auto lg:bottom-auto lg:w-auto lg:max-w-[95vw] lg:max-h-[95vh] flex flex-col chat-popout-in"
                  : "lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:max-h-none"
              }
              style={
                transmissionPopped && isDesktop
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
              bodyClassName={
                transmissionPopped
                  ? "chat-scroll flex-1 min-h-0 overflow-y-auto overscroll-contain"
                  : "chat-scroll lg:flex-1 lg:min-h-0 lg:overflow-y-auto"
              }
              titleEffect="trace"
              traceHue="#2ee6ff"
              onHeaderPointerDown={transmissionPopped && isDesktop ? handlePopoutHeaderPointerDown : undefined}
              onHeaderPointerMove={transmissionPopped && isDesktop ? handlePopoutHeaderPointerMove : undefined}
              onHeaderPointerUp={transmissionPopped && isDesktop ? handlePopoutHeaderPointerUp : undefined}
              cornerAction={
                transmissionPopped || latest || generating ? (
                  // Same button as the chat's pop-out toggle (Chat.tsx), so
                  // both panels' corners match popped and unpopped.
                  <button
                    type="button"
                    onClick={toggleTransmissionPopped}
                    aria-label={transmissionPopped ? "shrink transmission" : "pop out transmission"}
                    className="rounded border border-terminal/50 bg-terminal/10 px-2 py-1 text-xs font-semibold tracking-wide text-terminal transition-colors hover:bg-terminal/20 hover:border-terminal"
                  >
                    {transmissionPopped ? "⤡ shrink" : "⤢ pop out"}
                  </button>
                ) : undefined
              }
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
                  <TransmissionText
                    content={latest.content}
                    justRevealed={justGenerated}
                    popped={transmissionPopped}
                  />
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
                : // lg:[contain:size]: the frame stretches to the row's height
                  // but its content no longer sizes it — without this a long
                  // chat log grew the frame (and the page) instead of
                  // scrolling inside Chat's own message list.
                  `order-1 lg:order-none lg:w-2/3 lg:h-auto lg:max-h-none lg:[contain:size] ${
                    session ? "h-[min(70dvh,var(--chat-vv-h,70dvh))] max-h-[44rem]" : "h-48"
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

          {anyPopped && (
            <div
              className="fixed inset-0 z-40 bg-background/90"
              onClick={closePopouts}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Hidden while either popout is up: that panel is a focused modal
          with its own backdrop, and a spotlight sliding in over it would
          both overlap the popout and sit under its z-40 scrim. */}
      {!anyPopped && <ArchiveOfTheDay />}
    </main>
  );
}
