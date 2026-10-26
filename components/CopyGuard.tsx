"use client";

import { useEffect } from "react";
import { getSession, onAuthChange, displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

// Only the owner can copy, cut or paste text and images on the site. Locked
// is the default: everyone else (signed out included) gets no text
// selection, no copy/cut/paste, no dragging images out, and no right-click
// menu (public/assets/js/no-context-menu.js). Signing in as the owner sets
// data-copy-ok on <html>, which the listeners below, that script and the
// html:not([data-copy-ok]) rules in globals.css all check. Like the
// right-click block this is cosmetic, not security: DevTools still work.
export default function CopyGuard() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = (session: Parameters<typeof displayName>[0]) => {
      root.toggleAttribute("data-copy-ok", displayName(session) === OWNER_USERNAME);
    };
    getSession().then(apply);
    const unsubscribe = onAuthChange(apply);

    const block = (e: Event) => {
      if (!root.hasAttribute("data-copy-ok")) e.preventDefault();
    };
    const blockImageDrag = (e: DragEvent) => {
      if (e.target instanceof HTMLImageElement || e.target instanceof HTMLVideoElement) block(e);
    };
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    document.addEventListener("dragstart", blockImageDrag);
    return () => {
      unsubscribe();
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      document.removeEventListener("dragstart", blockImageDrag);
    };
  }, []);

  return null;
}
