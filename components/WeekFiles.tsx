"use client";

import { isLoopGifAsset } from "@/lib/loreAssets";

export type WeekFile = {
  number: number;
  title: string;
  open: boolean;
  image: { url: string } | null;
  // Already up before this week, but got new material in it.
  updated?: boolean;
};

// The THIS WEEK box: every file posted since Monday 8am Pacific
// (lib/archiveWeek.ts), in the front page's NEW FILE look (.newest-file-* in
// globals.css). Shown inside the archive (components/Archive.tsx) and on the
// /archive entrance (components/ArchiveEntrance.tsx). size "fluid" sizes it
// in em, like NewestFile's, so it scales with the entrance; "compact" is
// fluid with one-line titles and small thumbs, so a full week still leaves
// the entrance's lines and prompt on screen.
const SIZES = {
  default: {
    inner: "px-3 py-2.5",
    meta: "text-[11px] lg:text-sm mb-2",
    row: "gap-3 py-1.5 text-xs lg:text-sm",
    thumb: "w-10 h-10 lg:w-12 lg:h-12",
    title: "line-clamp-2",
  },
  fluid: {
    inner: "px-[0.9em] py-[0.6em]",
    meta: "text-[0.85em] mb-[0.5em]",
    row: "gap-[0.9em] py-[0.35em] text-[0.9em]",
    thumb: "w-[3em] h-[3em]",
    title: "line-clamp-2",
  },
  compact: {
    inner: "px-[0.9em] py-[0.5em]",
    meta: "text-[0.8em] mb-[0.35em]",
    row: "gap-[0.7em] py-[0.2em] text-[0.82em]",
    thumb: "w-[1.6em] h-[1.6em] text-[0.8em]",
    title: "truncate",
  },
};

export default function WeekFiles({
  files,
  onPick,
  size = "default",
}: {
  files: WeekFile[];
  onPick: (file: WeekFile) => void;
  size?: keyof typeof SIZES;
}) {
  if (files.length === 0) return null;
  const sz = SIZES[size];
  const updatedCount = files.filter((f) => f.updated).length;
  const newCount = files.length - updatedCount;
  const counts = [
    newCount > 0 && `${newCount} new ${newCount === 1 ? "file" : "files"}`,
    updatedCount > 0 && `${updatedCount} updated`,
  ].filter(Boolean);
  return (
    <section className="newest-file relative z-[1]" aria-label="this week's files">
      <div className={`newest-file-inner ${sz.inner}`}>
        <p className={`flex items-center gap-2 leading-none ${sz.meta}`}>
          <span className="newest-file-banner">THIS WEEK</span>
          <span className="newest-file-meta tabular-nums">
            {counts.join(" · ")}
          </span>
        </p>
        <ul className="divide-y divide-dim/20">
          {files.map((file) => (
            <li key={file.number}>
              <button
                type="button"
                onClick={() => onPick(file)}
                className={`group w-full flex items-center text-left ${sz.row}`}
              >
                {file.image ? (
                  isLoopGifAsset(file.image.url) ? (
                    <video
                      src={file.image.url}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className={`${sz.thumb} shrink-0 object-cover border border-dim`}
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.image.url} alt="" className={`${sz.thumb} shrink-0 object-cover border border-dim`} />
                  )
                ) : (
                  <span
                    aria-hidden="true"
                    className={`${sz.thumb} shrink-0 flex items-center justify-center border border-dim text-dim`}
                  >
                    {file.open ? "▣" : "?"}
                  </span>
                )}
                <span className="newest-file-meta tabular-nums shrink-0">{String(file.number).padStart(2, "0")}</span>
                <span className={`min-w-0 flex-1 text-foreground leading-snug ${sz.title} group-hover:text-terminal`}>
                  {file.title.replace(/^\d+\.\s*/, "")}
                </span>
                {file.updated && <span className="archive-updated-badge shrink-0">UPDATED</span>}
                <span className="hidden sm:inline shrink-0 text-terminal underline decoration-dim underline-offset-4 group-hover:text-foreground">
                  [ {file.open ? "read it" : "recover it"} ]
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
