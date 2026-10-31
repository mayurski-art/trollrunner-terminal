"use client";

import { buildLoreFlow, isLoopGifAsset } from "@/lib/loreAssets";
import { renderLoreLinks } from "@/lib/loreLinks";

type LoreImage = { id: string; url: string; caption: string };

// A recovered lore file's text with its images interleaved, shared by the
// archive list (components/Archive.tsx) and the front page's NEW FILE popup
// (components/NewFilePopup.tsx). Prose and pictures interleave
// (lib/loreAssets.ts's buildLoreFlow) so an image lands beside the part of
// the file it illustrates, instead of every picture stacking into a contact
// sheet under the finished article. Copying and the context menu are
// blocked for everyone but the owner, site-wide, by components/CopyGuard.tsx.
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
    <div>
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
                  // The image itself is the button, not an <img> inside a
                  // <button>: a press-and-hold has to land on the picture for
                  // iOS to offer the owner Save to Photos (CopyGuard's
                  // data-copy-ok; everyone else's callout is off in globals.css).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={`View full-size: ${img.caption}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onImageClick({ url: img.url, caption: img.caption })}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      onImageClick({ url: img.url, caption: img.caption });
                    }}
                    data-cursor="zoom"
                    className="block max-h-[32rem] w-auto max-w-full object-contain border border-dim/40 cursor-zoom-in"
                  />
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
