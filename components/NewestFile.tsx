"use client";

import { useEffect, useState } from "react";
import { isLoopGifAsset } from "@/lib/loreAssets";

type Newest = {
  number: number;
  title: string;
  seeded: boolean;
  image: { url: string; caption: string } | null;
};

// The front page's "newest file" box, above the tagline: whatever
// TROLL-LORE.md section has the highest number, with a deliberately loud
// banner (.newest-file-* in globals.css) so a fresh article can't be missed.
// Loud, but paced under the photosensitive-seizure threshold (no more than 3
// flashes a second, no full-field flashing) and still under reduced-motion.
export default function NewestFile() {
  const [newest, setNewest] = useState<Newest | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/newest-file")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && !data.error) setNewest(data as Newest);
      })
      .catch(() => {
        /* decorative — a failed fetch just means no box */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!newest) return null;

  return (
    <a
      href={`/archive?file=${newest.number}`}
      className="newest-file relative z-[1] block group"
      aria-label={`newest file ${newest.number}: ${newest.title}`}
    >
      <div className="newest-file-inner flex items-center gap-3 px-3 py-2">
        {newest.image &&
          (isLoopGifAsset(newest.image.url) ? (
            <video
              src={newest.image.url}
              autoPlay
              muted
              loop
              playsInline
              className="w-14 h-14 lg:w-16 lg:h-16 shrink-0 object-cover border border-dim"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={newest.image.url}
              alt={newest.image.caption}
              className="w-14 h-14 lg:w-16 lg:h-16 shrink-0 object-cover border border-dim"
            />
          ))}
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2 text-[10px] lg:text-sm leading-none mb-1">
            <span className="newest-file-banner font-bold tracking-widest" data-text="▓▒░ NEW FILE ░▒▓">
              ▓▒░ NEW FILE ░▒▓
            </span>
            <span className="text-dim tabular-nums">file {newest.number}</span>
          </p>
          <p className="text-foreground text-xs lg:text-sm leading-snug line-clamp-2 lg:line-clamp-1 group-hover:text-terminal">
            {newest.title}
          </p>
        </div>
        <span className="hidden sm:inline shrink-0 text-terminal text-[10px] lg:text-sm underline decoration-dim underline-offset-4 group-hover:text-foreground">
          [ {newest.seeded ? "read it" : "recover it"} ]
        </span>
      </div>
    </a>
  );
}
