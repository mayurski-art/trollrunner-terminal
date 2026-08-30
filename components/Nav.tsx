"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange, logout, displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";
import ProblemsCounter from "@/components/ProblemsCounter";
import AuthPanel from "@/components/AuthPanel";
import OwnerCredits from "@/components/OwnerCredits";

export default function Nav() {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const isOwner = displayName(session) === OWNER_USERNAME;

  return (
    <nav
      ref={navRef}
      className="relative flex items-center justify-between text-[11px] sm:text-sm text-dim mb-8 gap-x-3 gap-y-2"
    >
      <div className="relative flex flex-col items-start">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          className="nav-neon nav-neon--terminal whitespace-nowrap"
        >
          [ menu ]
        </button>
        <OwnerCredits session={session} section="usage" />
        {open && (
          <div className="absolute left-0 top-full mt-2 z-20 flex flex-col items-start gap-2 rounded-md border border-dim bg-black/90 backdrop-blur px-4 py-3 shadow-lg">
            <a
              href="https://trollrunner.net?enter=1"
              className="nav-neon nav-neon--home whitespace-nowrap"
            >
              [ home ]
            </a>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="nav-neon nav-neon--terminal whitespace-nowrap"
            >
              [ terminal ]
            </Link>
            <Link
              href="/vault"
              onClick={() => setOpen(false)}
              className="nav-neon nav-neon--vault whitespace-nowrap"
            >
              [ vault ]
            </Link>
            <Link
              href="/archive"
              onClick={() => setOpen(false)}
              className="nav-neon nav-neon--archive whitespace-nowrap"
            >
              [ archive ]
            </Link>
            <Link
              href="/logs"
              onClick={() => setOpen(false)}
              className="nav-neon nav-neon--logs whitespace-nowrap"
            >
              [ logs ]
            </Link>
            <Link
              href="/undervoice"
              onClick={() => setOpen(false)}
              className="nav-neon nav-neon--undervoice whitespace-nowrap"
            >
              [ undervoice ]
            </Link>
            {isOwner && (
              <Link
                href="/transmit"
                onClick={() => setOpen(false)}
                className="nav-neon nav-neon--transmit whitespace-nowrap"
              >
                [ transmit ]
              </Link>
            )}
            {isOwner && (
              <Link
                href="/inspect"
                onClick={() => setOpen(false)}
                className="nav-neon nav-neon--inspect whitespace-nowrap"
              >
                [ inspect ]
              </Link>
            )}
            {isOwner && (
              <Link
                href="/reports"
                onClick={() => setOpen(false)}
                className="nav-neon nav-neon--reports whitespace-nowrap"
              >
                [ reports ]
              </Link>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end">
        {session ? (
          <div className="flex items-center gap-3">
            <ProblemsCounter />
            <button
              type="button"
              onClick={() => logout()}
              title="click to disconnect"
              className="nav-neon nav-neon--disconnect whitespace-nowrap"
            >
              {displayName(session) ?? "you"} [ connected ]
            </button>
          </div>
        ) : (
          <div className="relative">
            <AuthPanel />
          </div>
        )}
        <OwnerCredits session={session} section="lock" />
      </div>
    </nav>
  );
}
