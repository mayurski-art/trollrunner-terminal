"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Meter from "@/components/Meter";
import { timeAgo } from "@/lib/time";

type Message = { role: "user" | "terminal"; content: string; created_at?: string };
type Wallet = { balance: number; qualifyingCount: number; qualifyingInterval: number };

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, qualifyingCount: 0, qualifyingInterval: 7 });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function authHeader(): Promise<Record<string, string>> {
    const sb = getPublicClient();
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headers = await authHeader();
      if (!headers.Authorization) {
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch("/api/chat", { headers });
        const data = await res.json();
        if (!cancelled && res.ok) {
          setMessages(data.messages ?? []);
          setWallet(data.wallet ?? wallet);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "the terminal did not respond");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "terminal", content: data.reply, created_at: new Date().toISOString() },
      ]);
      if (data.wallet) setWallet(data.wallet);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) {
    return <p className="text-dim text-sm animate-pulse">establishing uplink...</p>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <Meter
          fraction={wallet.qualifyingCount / wallet.qualifyingInterval}
          label={`mining: ${wallet.qualifyingCount}/${wallet.qualifyingInterval}`}
        />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 mb-3 max-h-80 pr-1">
        {messages.length === 0 && (
          <p className="text-dim text-sm">terminal&gt; it noticed you</p>
        )}
        {messages.map((m, i) => (
          <div key={i}>
            <p
              className={`whitespace-pre-wrap text-sm leading-relaxed ${
                m.role === "terminal" ? "text-terminal" : "text-you"
              }`}
            >
              <span className="text-dim">{m.role === "terminal" ? "terminal> " : "you> "}</span>
              {m.content}
            </p>
            {m.created_at && (
              <span className="text-terminal text-xs">{timeAgo(m.created_at)}</span>
            )}
          </div>
        ))}
        {busy && <p className="text-dim text-sm animate-pulse">terminal&gt; ...</p>}
      </div>
      {error && <p className="text-alert text-xs mb-2">[ {error} ]</p>}
      <form onSubmit={send} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something_"
          maxLength={1000}
          disabled={busy}
          className="flex-1 bg-transparent border border-dim px-2 py-1.5 text-sm text-you outline-none focus:border-terminal disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="border border-terminal text-terminal px-3 text-sm hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
        >
          &gt;
        </button>
      </form>
    </div>
  );
}
