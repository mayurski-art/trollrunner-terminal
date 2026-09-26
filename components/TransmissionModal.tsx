"use client";

import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { isToday, type Kind, type Post } from "@/app/logs/page";
import PostGuess from "@/components/PostGuess";
import { timeAgo } from "@/lib/time";
import { renderTightLines } from "@/lib/renderText";

type Props = {
  post: Post;
  kind: Kind;
  kindMeta: Record<Kind, { label: string }>;
  session: Session | null;
  onClose: () => void;
};

// Centered "pop out" view for a single transmission, opened from the
// [ pop out ] corner action on its card in the logs grid. Same
// backdrop + centered role="dialog" convention as Faq.tsx, sized to the
// screen since it's showing one transmission full-size:
//   phones (<640)     near full-screen, 12px gutter
//   tablets (640+)    92vw wide
//   laptops (1024+)   85vw, capped at 1200px
//   big screens (1536+) 75vw, capped at 1500px
// Heights use dvh so a phone's browser bar can't cut off the bottom; the
// body scrolls inside the dialog when a transmission runs longer.
export default function TransmissionModal({ post, kind, kindMeta, session, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-background/90"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="transmission"
        className="fixed inset-3 max-h-[calc(100dvh-1.5rem)] z-50 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[92vw] sm:max-h-[88dvh] sm:min-h-[50dvh] lg:w-[min(85vw,1200px)] lg:min-h-[65dvh] 2xl:w-[min(75vw,1500px)] overflow-y-auto overscroll-contain border border-dim bg-panel/95 backdrop-blur-sm text-left p-4 sm:p-6 lg:p-8 2xl:p-10"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="text-terminal text-sm lg:text-base tracking-wide">[ transmission ]</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="shrink transmission"
            className="rounded border border-terminal/50 bg-terminal/10 px-2 py-1 text-xs font-semibold tracking-wide text-terminal transition-colors hover:bg-terminal/20 hover:border-terminal shrink-0"
          >
            ⤡ shrink
          </button>
        </div>

        <div className="text-terminal text-lg sm:text-xl lg:text-2xl 2xl:text-3xl leading-relaxed font-transmission">
          {renderTightLines(post.content, !isToday(post.posted_at))}
        </div>

        {post.art_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.art_url}
            alt=""
            className="mt-4 w-full max-h-[60dvh] object-contain rounded border border-dim"
          />
        )}

        <div className="mt-4 pt-3 border-t border-dim/40 flex items-center gap-3 text-xs lg:text-sm text-dim">
          <span>{timeAgo(post.posted_at)}</span>
          <span className="text-problem">{kindMeta[kind].label}</span>
          {post.x_post_url && (
            <a
              href={post.x_post_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto hover:text-terminal underline decoration-dim underline-offset-2"
            >
              view on x
            </a>
          )}
        </div>

        <PostGuess postId={post.id} session={session} />
      </div>
    </>
  );
}
