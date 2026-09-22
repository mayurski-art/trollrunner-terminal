"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import AuthPanel from "@/components/AuthPanel";
import Archive from "@/components/Archive";
import Faq from "@/components/Faq";
import { BANNER_ARCHIVE } from "@/lib/ascii";

export default function ArchivePage() {
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
      <div className="home-hero-bg-frame" aria-hidden="true">
        <div className="home-hero-bg" />
      </div>
      <div className="w-full max-w-6xl">
        <Nav />

        <div className="mb-2">
          <Banner art={BANNER_ARCHIVE} label="archive" />
        </div>
        <p className="relative z-[1] text-foreground/80 text-sm mb-10 [text-shadow:0_1px_3px_var(--background)]">
          it remembers everything you&apos;ve dragged out of it. talk to it, or pay for what you
          haven&apos;t earned yet.
        </p>

        <Frame title="archive" tone="terminal">
          {!loaded ? (
            <p className="text-dim text-sm animate-pulse">checking clearance...</p>
          ) : !session ? (
            <div className="space-y-4">
              <p className="text-dim text-sm">sign in to reach this.</p>
              <AuthPanel />
            </div>
          ) : (
            <Archive />
          )}
        </Frame>

        <p className="relative z-[1] text-foreground text-xs mt-8 text-center [text-shadow:0_1px_3px_var(--background)]">
          part of the{" "}
          <a
            href="https://trollrunner.net"
            className="glow-loop underline decoration-dim underline-offset-4"
          >
            trollrunner.net
          </a>{" "}
          network
        </p>
        <Faq />
      </div>
    </main>
  );
}
