"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import Archive from "@/components/Archive";
import ArchiveEntrance from "@/components/ArchiveEntrance";
import { BANNER_ARCHIVE } from "@/lib/ascii";

// The archive page. /archive renders it bare; /[number] (app/[file]/page.tsx)
// passes the file to open, so trolltruths.com/82 lands on §82.
export default function ArchiveScreen({ file }: { file?: number }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoaded(true);
    });
    return onAuthChange(setSession);
  }, []);

  return (
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <ArchiveEntrance />
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      <div className="w-full max-w-6xl">
        <Nav />

        <div className="mb-2">
          <Banner art={BANNER_ARCHIVE} label="archive" />
        </div>
        <p className="relative z-[1] text-foreground/80 text-sm mb-10 [text-shadow:0_1px_3px_var(--background)]">
          spend 1 PROBLEM to unlock a piece of troll history
        </p>

        <Frame title="archive" tone="terminal">
          {/* Signed-out visitors still get the archive: freshly posted files
              are free to read for their first day (lib/loreArchive.ts), and
              Archive asks them to sign in only to unlock a sealed one. Keyed
              on the user so signing in or out reloads the manifest. */}
          {!loaded ? (
            <p className="text-dim text-sm animate-pulse">checking clearance...</p>
          ) : (
            <Archive key={session?.user.id ?? "anon"} file={file} signedIn={!!session} />
          )}
        </Frame>

      </div>
    </main>
  );
}
