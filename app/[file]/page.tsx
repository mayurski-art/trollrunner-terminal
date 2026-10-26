import { notFound } from "next/navigation";
import ArchiveScreen from "@/components/ArchiveScreen";

// Every archive file has a short link at its number: trolltruths.com/82 is
// TROLL-LORE.md §82. It's the archive page pointed at that file, same as the
// older /archive?file=82 deep link. Anything that isn't a plain number 404s.
export default async function FilePage(props: PageProps<"/[file]">) {
  const { file } = await props.params;
  if (!/^\d+$/.test(file)) notFound();
  return <ArchiveScreen file={Number(file)} />;
}
