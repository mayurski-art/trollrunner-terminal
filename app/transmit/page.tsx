"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange, displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import AuthPanel from "@/components/AuthPanel";
import Transmit from "@/components/Transmit";
import { BANNER_TERMINAL } from "@/lib/ascii";

export default function TransmitPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoaded(true);
    });
    return onAuthChange(setSession);
  }, []);

  const isOwner = displayName(session) === OWNER_USERNAME;

  return (
    <main className="home-hero flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="home-hero-bg-frame w-full max-w-4xl" aria-hidden="true">
        <div className="home-hero-bg" />
        <div className="home-hero-bg home-hero-bg--sharpen" />
      </div>
      <div className="w-full max-w-4xl">
        <Nav />

        <div className="mb-2">
          <Banner art={BANNER_TERMINAL} label="transmit" />
        </div>
        <p className="text-dim text-sm mb-10">
          it wrote them. you carry them out.
        </p>

        <Frame title="transmit" tone="problem">
          {!loaded ? (
            <p className="text-dim text-sm animate-pulse">checking clearance...</p>
          ) : !session ? (
            <div className="space-y-4">
              <p className="text-dim text-sm">sign in to reach this.</p>
              <AuthPanel />
            </div>
          ) : isOwner ? (
            <Transmit />
          ) : (
            <p className="text-alert text-sm">[ this channel isn&apos;t yours ]</p>
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
