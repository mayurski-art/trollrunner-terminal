import { NextResponse } from "next/server";
import { allSectionTitles, sectionsPostedSince, sectionsUpdatedSince } from "@/lib/loreSections";
import { archiveWeek } from "@/lib/archiveWeek";
import { isOpenToAll, sectionDepth } from "@/lib/loreArchive";
import { findLoreImagesForArchiveSection } from "@/lib/loreAssets";

// Public, like /api/newest-file: the /archive entrance's THIS WEEK list
// (components/ArchiveEntrance.tsx), before the reader is in the archive and
// before it knows who they are. So it follows the signed-out manifest's
// rules (app/api/archive/route.ts): a picture only for a file anyone can
// read, and a sealed depth-2 file keeps its "??" title.
export const dynamic = "force-dynamic";

export async function GET() {
  const week = archiveWeek();
  const titles = new Map(allSectionTitles().map((s) => [s.number, s.title]));
  // New files first, then files already up that got new material this week.
  const updated = new Set(sectionsUpdatedSince(week.startsAt));
  const files = [...sectionsPostedSince(week.startsAt), ...updated].flatMap((number) => {
    const title = titles.get(number);
    if (!title) return [];
    const open = isOpenToAll(number);
    const image = open ? (findLoreImagesForArchiveSection(number)[0] ?? null) : null;
    return [
      {
        number,
        title: open || sectionDepth(number) === 1 ? title : "??",
        open,
        image: image ? { url: image.url, caption: image.caption } : null,
        updated: updated.has(number),
      },
    ];
  });
  return NextResponse.json({ files, endsAt: new Date(week.endsAt).toISOString() });
}
