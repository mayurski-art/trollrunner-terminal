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
    <nav className="flex items-center justify-between text-xs sm:text-sm text-dim mb-8 flex-wrap gap-3">
      <div className="flex gap-4">
        <Link href="/" className="hover:text-terminal">
          [ terminal ]
        </Link>
        <Link href="/vault" className="hover:text-problem">
          [ vault ]
        </Link>
        <Link href="/archive" className="hover:text-terminal">
          [ archive ]
        </Link>
        <Link href="/logs" className="hover:text-foreground">
          [ logs ]
        </Link>
<Link href="/undervoice" className="hover:text-alert">
          [ undervoice ]
        </Link>
        {isOwner && (
          <Link href="/transmit" className="hover:text-problem">
            [ transmit ]
          </Link>
        )}
        {isOwner && (
          <Link href="/inspect" className="hover:text-problem">
            [ inspect ]
          </Link>
        )}
        {isOwner && (
          <Link href="/reports" className="hover:text-problem">
            [ reports ]
          </Link>
        )}
      </div>
      {session ? (
        <div className="flex items-center gap-3">
          <span className="text-you">{displayName(session) ?? "connected"}</span>
          <button onClick={() => logout()} className="hover:text-alert">
            [ disconnect ]
          </button>
        </div>
      ) : (
        <span className="text-ghost">not connected</span>
      )}
    </nav>
  );
}
