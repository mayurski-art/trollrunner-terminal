"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import AuthPanel from "@/components/AuthPanel";
import Archive from "@/components/Archive";
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
      <div className="w-full max-w-3xl">
        <Nav />

        <div className="mb-2">
          <Banner art={BANNER_ARCHIVE} label="archive" />
        </div>
        <p className="text-dim text-sm mb-10">
          it knows forty-four things. talk to it, or pay for what you haven&apos;t earned yet.
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

        <p className="text-dim text-xs mt-8 text-center">
          part of the{" "}
          <a
            href="https://trollrunner.net"
            className="underline decoration-dim underline-offset-4 hover:text-terminal"
          >
            trollrunner.net
          </a>{" "}
          network
        </p>
      </div>
    </main>
  );
}
