import { NextResponse } from "next/server";
import { newestSection } from "@/lib/loreSections";
import { findLoreImagesForArchiveSection } from "@/lib/loreAssets";
import { isSeeded } from "@/lib/loreArchive";

// Public, like /api/archive-of-the-day: the front page's "newest file" box
// shows just a number, a title and one image, and links into the archive,
// where recovering the file still costs PROBLEMS. New sections always get
// the next free number (TROLL-LORE.md never renumbers), so the highest
// number is the newest file.
//
// A file only counts as new for a day. Its time comes from the
// `<!-- posted: ... -->` line under its heading. Once that's more than
// NEW_FOR_MS old, or if the file has no posted line, this returns
// { newest: null } and the box stays hidden until the next file goes up.
export const dynamic = "force-dynamic";

const NEW_FOR_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const newest = newestSection();
  const postedMs = newest?.postedAt ? Date.parse(newest.postedAt) : NaN;
  if (!newest || Number.isNaN(postedMs) || Date.now() - postedMs > NEW_FOR_MS) {
    return NextResponse.json({ newest: null });
  }
  const image = findLoreImagesForArchiveSection(newest.number)[0] ?? null;
  return NextResponse.json({
    newest: {
      number: newest.number,
      title: newest.title.replace(/^\d+\.\s*/, ""),
      seeded: isSeeded(newest.number),
      image: image ? { url: image.url, caption: image.caption } : null,
      expiresAt: new Date(postedMs + NEW_FOR_MS).toISOString(),
    },
  });
}
