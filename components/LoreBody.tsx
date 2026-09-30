"use client";

import { buildLoreFlow, isLoopGifAsset } from "@/lib/loreAssets";
import { renderLoreLinks } from "@/lib/loreLinks";

type LoreImage = { id: string; url: string; caption: string };

// A recovered lore file's text with its images interleaved, shared by the
// archive list (components/Archive.tsx) and the front page's NEW FILE popup
// (components/NewFilePopup.tsx). Prose and pictures interleave
// (lib/loreAssets.ts's buildLoreFlow) so an image lands beside the part of
// the file it illustrates, instead of every picture stacking into a contact
// sheet under the finished article. Copy and the context menu are blocked,
// as they always were in the archive.
export default function LoreBody({
  body,
  images,
  onImageClick,
}: {
  body: string;
  images: LoreImage[];
  onImageClick?: (img: { url: string; caption: string }) => void;
}) {
  return (
    <div className="select-none" onCopy={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
      {buildLoreFlow(body, images).map((item, i) =>
        item.kind === "text" ? (
          <p key={`t${i}`} className="whitespace-pre-wrap leading-relaxed text-sm [&:not(:first-child)]:mt-4">
            {renderLoreLinks(item.text)}
          </p>
        ) : (
          <div
            key={`i${i}`}
            className={`my-4 grid grid-cols-1 gap-3 ${item.images.length > 1 ? "sm:grid-cols-2" : ""}`}
          >
            {item.images.map((img) => (
              <figure key={img.id}>
                {isLoopGifAsset(img.url) ? (
                  <video
                    src={img.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="max-h-[32rem] w-auto max-w-full object-contain border border-dim/40"
                    aria-label={img.caption}
                  />
                ) : onImageClick ? (
                  <button
                    type="button"
                    onClick={() => onImageClick({ url: img.url, caption: img.caption })}
                    aria-label={`View full-size: ${img.caption}`}
                    data-cursor="zoom"
                    className="block w-full cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.caption}
                      className="max-h-[32rem] w-auto max-w-full object-contain border border-dim/40 pointer-events-none"
                    />
                  </button>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={img.caption}
                    className="max-h-[32rem] w-auto max-w-full object-contain border border-dim/40"
                  />
                )}
                <figcaption className="text-dim text-xs mt-1">{img.caption}</figcaption>
              </figure>
            ))}
          </div>
        )
      )}
    </div>
  );
}
