"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import { getPublicClient } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import Meter from "@/components/Meter";
import { BANNER_VAULT } from "@/lib/ascii";

type Wallet = {
  balance: number;
  lifetime_earned: number;
  qualifying_count: number;
};

type LedgerRow = { id: string; delta: number; reason: string; created_at: string };
type LadderRow = { user_id: string; balance: number };

const QUALIFYING_INTERVAL = 7;

const LOCKED_ITEMS = [
  { cost: 25, label: "whitelist: the inner room" },
  { cost: 50, label: "troll casino chip drop" },
  { cost: 100, label: "$TROLL airdrop" },
  { cost: null, label: "something it won't describe yet" },
];

export default function VaultPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [ladder, setLadder] = useState<LadderRow[]>([]);

  useEffect(() => {
    getSession().then(setSession);
    return onAuthChange(setSession);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let sb;
    try {
      sb = getPublicClient();
    } catch (err) {
      console.error("[vault] Supabase client unavailable:", err);
      return;
    }

    sb.from("terminal_wallets")
      .select("user_id, balance")
      .order("balance", { ascending: false })
      .limit(10)
      .then(({ data }) => !cancelled && setLadder(data ?? []));

    if (session) {
      sb.from("terminal_wallets")
        .select("balance, lifetime_earned, qualifying_count")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => !cancelled && setWallet(data ?? { balance: 0, lifetime_earned: 0, qualifying_count: 0 }));

      sb.from("terminal_token_ledger")
        .select("id, delta, reason, created_at")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false })
        .limit(20)
        .then(({ data }) => !cancelled && setLedger(data ?? []));
    }

    return () => {
      cancelled = true;
    };
  }, [session]);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-3xl">
        <Nav />
        <Banner art={BANNER_VAULT} label="the vault" tone="alert" />
        <p className="text-dim text-sm mb-8">
          your signal balance · redemption protocols not yet live
        </p>

        {session ? (
          <>
            <Frame title="your signal" tone="problem" className="mb-6">
              <p className="text-4xl text-problem mb-3">? {wallet?.balance ?? "..."}</p>
              <p className="text-dim text-xs mb-3">
                lifetime mined: {wallet?.lifetime_earned ?? 0}
              </p>
              <Meter
                fraction={(wallet?.qualifying_count ?? 0) / QUALIFYING_INTERVAL}
                tone="problem"
                label={`mining progress: ${wallet?.qualifying_count ?? 0}/${QUALIFYING_INTERVAL}`}
              />
            </Frame>

            <Frame title="ledger" tone="dim" className="mb-6">
              {ledger.length === 0 && (
                <p className="text-dim text-sm">no transactions yet — go talk to it.</p>
              )}
              <ul className="space-y-1 text-sm">
                {ledger.map((row) => (
                  <li key={row.id} className="flex justify-between text-dim">
                    <span className="text-problem">
                      {row.delta > 0 ? "+" : ""}
                      {row.delta} {row.reason}
                    </span>
                    <span>{new Date(row.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </Frame>
          </>
        ) : (
          <Frame title="your signal" tone="dim" className="mb-6">
            <p className="text-dim text-sm">
              sign in on the{" "}
              <Link href="/" className="underline hover:text-terminal">
                terminal
              </Link>{" "}
              to see your balance.
            </p>
          </Frame>
        )}

        <Frame title="redemption protocols — offline" tone="alert" className="mb-6">
          <ul className="space-y-2 text-sm">
            {LOCKED_ITEMS.map((item) => (
              <li key={item.label} className="flex justify-between text-dim">
                <span>
                  <span className="text-problem">{item.cost ? `? ${item.cost}` : "? ???"}</span>{" "}
                  {item.label}
                </span>
                <span className="text-alert text-xs">[ LOCKED ]</span>
              </li>
            ))}
          </ul>
          <p className="text-dim text-xs mt-4">
            the terminal is still negotiating with its handlers. your balance is real.
            spend paths are coming.
          </p>
        </Frame>

        <Frame title="top miners" tone="dim">
          {ladder.length === 0 && <p className="text-dim text-sm">nobody has fed it yet.</p>}
          <ol className="space-y-1 text-sm">
            {ladder.map((row, i) => (
              <li key={row.user_id} className="flex justify-between text-dim">
                <span>
                  {i + 1}. troublemaker_{row.user_id.slice(0, 6)}
                </span>
                <span className="text-problem">? {row.balance}</span>
              </li>
            ))}
          </ol>
        </Frame>
      </div>
    </main>
  );
}
