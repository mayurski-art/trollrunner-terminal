// Shared bits of the "pop this panel out into a floating window" behavior,
// used by the homepage chat and the vault ledger. Both render a Frame that
// goes position:fixed when popped, centered on open and draggable by its
// title bar.

export type PopoutSize = { width: number; height: number };

// Popped panels are capped at 95vw/95vh (via lg:max-w-[95vw]/lg:max-h-[95vh]
// on the Frame), so the centering math has to respect the same cap or a
// panel larger than the viewport would be centered on its uncapped size and
// hang off the top-left.
function cappedSize(size: PopoutSize) {
  return {
    w: Math.min(size.width, window.innerWidth * 0.95),
    h: Math.min(size.height, window.innerHeight * 0.95),
  };
}

// Centered position for a popout of `size` in the current viewport.
// Computed on demand (at click/resize) rather than in an effect, so opening
// a panel doesn't need a second render pass to place itself — setting state
// from inside an effect is what react-hooks/set-state-in-effect warns about.
export function centeredPopoutPos(size: PopoutSize) {
  const { w, h } = cappedSize(size);
  return {
    top: Math.max(0, (window.innerHeight - h) / 2),
    left: Math.max(0, (window.innerWidth - w) / 2),
  };
}

// Clamps a dragged position so the panel can't be pulled off-screen.
export function clampPopoutPos(size: PopoutSize, top: number, left: number) {
  const { w, h } = cappedSize(size);
  return {
    top: Math.min(Math.max(0, top), Math.max(0, window.innerHeight - h)),
    left: Math.min(Math.max(0, left), Math.max(0, window.innerWidth - w)),
  };
}

// Mirrors Tailwind's lg breakpoint. Read through useSyncExternalStore rather
// than useState + useEffect: the match is external state React should
// subscribe to, and seeding it from an effect costs an extra render (and
// trips react-hooks/set-state-in-effect).
const DESKTOP_MQ = "(min-width: 1024px)";

export function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MQ).matches;
}

// The server has no viewport; false matches the mobile-first classes that
// render before hydration.
export function getDesktopServerSnapshot() {
  return false;
}
