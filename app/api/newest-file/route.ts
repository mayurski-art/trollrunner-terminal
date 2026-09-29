import { NextResponse } from "next/server";
import { allSectionTitles } from "@/lib/loreSections";
import { findLoreImagesForArchiveSection } from "@/lib/loreAssets";
import { isSeeded } from "@/lib/loreArchive";

// Public, like /api/archive-of-the-day: the front page's "newest file" box
// shows just a number, a title and one image, and links into the archive,
// where recovering the file still costs PROBLEMS. New sections always get
// the next free number (TROLL-LORE.md never renumbers), so the highest
// number is the newest file.
export const dynamic = "force-dynamic";

export async function GET() {
  const titles = allSectionTitles();
  const newest = titles[titles.length - 1];
  if (!newest) {
    return NextResponse.json({ error: "no archive sections available" }, { status: 500 });
  }
  const image = findLoreImagesForArchiveSection(newest.number)[0] ?? null;
  return NextResponse.json({
    number: newest.number,
    title: newest.title.replace(/^\d+\.\s*/, ""),
    seeded: isSeeded(newest.number),
    image: image ? { url: image.url, caption: image.caption } : null,
  });
}
