// A file picked on the /archive entrance (components/ArchiveEntrance.tsx)
// for the archive (components/Archive.tsx) to open once the entrance fades.
// The archive may still be loading its manifest when the pick happens, so
// the number waits here until it takes it, and an event tells an archive
// that's already loaded.
const EVENT = "archive-goto";
let pending: number | null = null;

export function requestArchiveFile(number: number) {
  pending = number;
  window.dispatchEvent(new Event(EVENT));
}

export function takeArchiveFile(): number | null {
  const n = pending;
  pending = null;
  return n;
}

export function onArchiveFileRequest(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
