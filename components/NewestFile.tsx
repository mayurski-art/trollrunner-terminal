"use client";

import { useCallback, useEffect, useState } from "react";
import { isLoopGifAsset } from "@/lib/loreAssets";
import NewFilePopup from "@/components/NewFilePopup";

type Newest = {
  number: number;
  title: string;
  seeded: boolean;
  image: { url: string; caption: string } | null;
  expiresAt: string;
};

// The front page's "newest file" box, above the tagline: whatever
// TROLL-LORE.md section has the highest number, for the first day after it
// was posted (/api/newest-file decides; it sends nothing once the day is up).
// Deliberately loud (.newest-file-* in globals.css) so a fresh article can't
// be missed, but paced under the photosensitive-seizure threshold and still
// under reduced motion. Clicking it pops the article out over the terminal
// (components/NewFilePopup.tsx) rather than leaving the page.
//
// size "fluid" sizes everything in em, so the box scales with whatever
// font-size its container sets (the /archive entrance scales it with the
// screen width). The default keeps the front page's fixed sizes.
const SIZES = {
  default: {
    inner: "gap-3 px-3 py-2",
    thumb: "w-14 h-14 lg:w-16 lg:h-16",
    meta: "text-[11px] lg:text-sm mb-1.5",
    title: "text-xs lg:text-sm",
    cta: "text-[11px] lg:text-sm",
  },
  fluid: {
    inner: "gap-[0.9em] px-[0.9em] py-[0.6em]",
    thumb: "w-[4.6em] h-[4.6em]",
    meta: "text-[0.85em] mb-[0.5em]",
    title: "text-[1em]",
    cta: "text-[0.85em]",
  },
};

export default function NewestFile({
  onPopupChange,
  size = "default",
}: { onPopupChange?: (open: boolean) => void; size?: keyof typeof SIZES } = {}) {
  const sz = SIZES[size];
  const [newest, setNewest] = useState<Newest | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const closePopup = useCallback(() => {
    setPopupOpen(false);
    onPopupChange?.(false);
  }, [onPopupChange]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/newest-file")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.newest) setNewest(data.newest as Newest);
      })
      .catch(() => {
        /* decorative — a failed fetch just means no box */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A tab left open past the 24 hours drops the box on its own.
  useEffect(() => {
    if (!newest) return;
    const ms = new Date(newest.expiresAt).getTime() - Date.now();
    if (ms <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNewest(null);
      return;
    }
    const timer = setTimeout(() => setNewest(null), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(timer);
  }, [newest]);

  if (!newest) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPopupOpen(true);
          onPopupChange?.(true);
        }}
        className="newest-file relative z-[1] block w-full text-left group"
        aria-label={`new file ${newest.number}: ${newest.title}`}
        aria-haspopup="dialog"
      >
        <div className={`newest-file-inner flex items-center ${sz.inner}`}>
          {newest.image &&
            (isLoopGifAsset(newest.image.url) ? (
              <video
                src={newest.image.url}
                autoPlay
                muted
                loop
                playsInline
                className={`${sz.thumb} shrink-0 object-cover border border-dim`}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={newest.image.url}
                alt={newest.image.caption}
                className={`${sz.thumb} shrink-0 object-cover border border-dim`}
              />
            ))}
          <div className="min-w-0 flex-1">
            <p className={`flex items-center gap-2 leading-none ${sz.meta}`}>
              <span className="newest-file-banner">NEW FILE</span>
              <span className="newest-file-meta tabular-nums">file {newest.number}</span>
            </p>
            <p className={`text-foreground leading-snug line-clamp-2 group-hover:text-terminal ${sz.title}`}>
              {newest.title}
            </p>
          </div>
          <span
            className={`hidden sm:inline shrink-0 text-terminal underline decoration-dim underline-offset-4 group-hover:text-foreground ${sz.cta}`}
          >
            [ {newest.seeded ? "read it" : "recover it"} ]
          </span>
        </div>
      </button>
      {popupOpen && <NewFilePopup number={newest.number} title={newest.title} onClose={closePopup} />}
    </>
  );
}
