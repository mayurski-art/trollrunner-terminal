"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange, logout, displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";

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
        <a href="https://trollrunner.net?enter=1" className="hover:text-you whitespace-nowrap">
          [ home ]
        </a>
        <Link href="/" className="hover:text-terminal whitespace-nowrap">
          [ terminal ]
        </Link>
        <Link href="/vault" className="hover:text-problem whitespace-nowrap">
          [ vault ]
        </Link>
        <Link href="/archive" className="hover:text-terminal whitespace-nowrap">
          [ archive ]
        </Link>
        <Link href="/logs" className="hover:text-foreground whitespace-nowrap">
          [ logs ]
        </Link>
        <Link href="/undervoice" className="hover:text-alert whitespace-nowrap">
          [ undervoice ]
        </Link>
        {isOwner && (
          <Link href="/transmit" className="hover:text-problem whitespace-nowrap">
            [ transmit ]
          </Link>
        )}
        {isOwner && (
          <Link href="/inspect" className="hover:text-problem whitespace-nowrap">
            [ inspect ]
          </Link>
        )}
        {isOwner && (
          <Link href="/reports" className="hover:text-problem whitespace-nowrap">
            [ reports ]
          </Link>
        )}
      </div>
      {session ? (
        <div className="flex items-center gap-3">
          <span className="text-you">{displayName(session) ?? "connected"}</span>
          <button onClick={() => logout()} className="hover:text-alert whitespace-nowrap">
            [ disconnect ]
          </button>
        </div>
      ) : (
        <span className="text-ghost">not connected</span>
      )}
    </nav>
  );
}
