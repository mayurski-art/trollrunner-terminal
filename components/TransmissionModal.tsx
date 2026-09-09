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
  kindMeta: Record<Kind, { label: string; mark: string }>;
  session: Session | null;
  onClose: () => void;
};

// Centered "pop out" view for a single transmission, opened from the
// [ pop out ] corner action on its card in the logs grid. Same
// backdrop + centered role="dialog" convention as Faq.tsx, sized larger
// since it's showing one transmission full-size rather than a copy list.
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
        className="fixed inset-4 z-50 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl sm:max-h-[80vh] overflow-y-auto border border-dim bg-panel/95 backdrop-blur-sm text-left p-4 sm:p-6"
      >
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="text-terminal text-sm tracking-wide">[ transmission ]</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="shrink transmission"
            className="rounded border border-terminal/50 bg-terminal/10 px-2 py-1 text-xs font-semibold tracking-wide text-terminal transition-colors hover:bg-terminal/20 hover:border-terminal shrink-0"
          >
            ⤡ shrink
          </button>
        </div>

        <div className="text-terminal text-base sm:text-lg leading-relaxed font-transmission">
          {renderTightLines(post.content, !isToday(post.posted_at))}
        </div>

        {post.art_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.art_url}
            alt=""
            className="mt-4 w-full rounded border border-dim"
          />
        )}

        <div className="mt-4 pt-3 border-t border-dim/40 flex items-center gap-3 text-xs text-dim">
          <span>{timeAgo(post.posted_at)}</span>
          {kind !== "unmarked" && (
            <span className="text-problem">
              <span className="text-[10px]">{kindMeta[kind].mark}</span> {kindMeta[kind].label}
            </span>
          )}
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
