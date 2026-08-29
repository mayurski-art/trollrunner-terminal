"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange, logout, displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";
import ProblemsCounter from "@/components/ProblemsCounter";

export default function Nav() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  const isOwner = displayName(session) === OWNER_USERNAME;

  return (
    <nav className="flex items-center justify-between text-[11px] sm:text-sm text-dim mb-8 flex-wrap gap-x-3 gap-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-2 sm:gap-4">
        <a href="https://trollrunner.net?enter=1" className="nav-neon nav-neon--home whitespace-nowrap">
          [ home ]
        </a>
        <Link href="/" className="nav-neon nav-neon--terminal whitespace-nowrap">
          [ terminal ]
        </Link>
        <Link href="/vault" className="nav-neon nav-neon--vault whitespace-nowrap">
          [ vault ]
        </Link>
        <Link href="/archive" className="nav-neon nav-neon--archive whitespace-nowrap">
          [ archive ]
        </Link>
        <Link href="/logs" className="nav-neon nav-neon--logs whitespace-nowrap">
          [ logs ]
        </Link>
        <Link href="/undervoice" className="nav-neon nav-neon--undervoice whitespace-nowrap">
          [ undervoice ]
        </Link>
        {isOwner && (
          <Link href="/transmit" className="nav-neon nav-neon--transmit whitespace-nowrap">
            [ transmit ]
          </Link>
        )}
        {isOwner && (
          <Link href="/inspect" className="nav-neon nav-neon--inspect whitespace-nowrap">
            [ inspect ]
          </Link>
        )}
        {isOwner && (
          <Link href="/reports" className="nav-neon nav-neon--reports whitespace-nowrap">
            [ reports ]
          </Link>
        )}
      </div>
      {session ? (
        <div className="flex items-center gap-3">
          <ProblemsCounter />
          <span className="text-you">{displayName(session) ?? "connected"}</span>
          <button onClick={() => logout()} className="nav-neon nav-neon--disconnect whitespace-nowrap">
            [ disconnect ]
          </button>
        </div>
      ) : (
        <span className="text-ghost">not connected</span>
      )}
    </nav>
  );
}
