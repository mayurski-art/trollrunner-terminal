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

// A sealed file a signed-out visitor tried to unlock. Signing in remounts the
// archive (ArchiveScreen keys it on the user), so the number waits here and
// the signed-in archive scrolls straight back to that file instead of
// leaving them at the top of the list.
let pendingAfterSignIn: number | null = null;

export function rememberFileForSignIn(number: number) {
  pendingAfterSignIn = number;
}

export function takeFileAfterSignIn(): number | null {
  const n = pendingAfterSignIn;
  pendingAfterSignIn = null;
  return n;
}
