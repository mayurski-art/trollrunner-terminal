"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import AuthPanel from "@/components/AuthPanel";
import Undervoice from "@/components/Undervoice";
import { BANNER_UNDERVOICE } from "@/lib/ascii";

export default function UndervoicePage() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    getSession().then(setSession);
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
          <Banner art={BANNER_UNDERVOICE} label="the undervoice" />
        </div>
        <p className="text-dim text-sm mb-10">
          something the terminal above only half-admits to. reaching it costs what you already earned.
        </p>

        <Frame title="the undervoice" tone="dim">
          {session ? (
            <Undervoice />
          ) : (
            <div className="space-y-4">
              <p className="text-dim text-sm">sign in to spend anything down here.</p>
              <AuthPanel />
            </div>
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
