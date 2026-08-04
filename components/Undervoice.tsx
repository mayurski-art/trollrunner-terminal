"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Meter from "@/components/Meter";

type Message = { role: "user" | "terminal"; content: string; created_at?: string };
type SessionState = { id: string; costPaid: number; messageCount: number } | null;
type Config = { paused: boolean; sessionCost: number; maxMessages: number };
type OutcomeResult = { outcome: "refund" | "bonus" | "charge" | "none"; delta: number };

const OUTCOME_LINE: Record<OutcomeResult["outcome"], (delta: number) => string> = {
  refund: (d) => `+${d} refunded`,
  bonus: (d) => `+${d} bonus`,
  charge: (d) => `${d} taken`,
  none: () => "nothing changes hands",
};

async function authHeader(): Promise<Record<string, string>> {
  const sb = getPublicClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Undervoice() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [session, setSession] = useState<SessionState>(null);
  const [config, setConfig] = useState<Config>({ paused: false, sessionCost: 5, maxMessages: 8 });
  const [balance, setBalance] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [outcome, setOutcome] = useState<OutcomeResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const headers = await authHeader();
      if (!headers.Authorization) {
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch("/api/undervoice", { headers });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        setSession(data.session ?? null);
        setBalance(data.wallet?.balance ?? 0);
        setConfig(data.config ?? config);
        setMessages(
          (data.messages ?? []).map((m: { role: string; content: string; created_at: string }) => ({
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          }))
        );
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

  async function openSession() {
    if (opening) return;
    setOpening(true);
    setError(null);
    setOutcome(null);
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/undervoice", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "open" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "could not open a session");
        return;
      }
      setSession(data.session);
      setBalance(data.wallet?.balance ?? balance);
      setMessages([]);
    } catch {
      setError("connection lost");
    } finally {
      setOpening(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !session) return;
    setError(null);
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/undervoice", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "message", sessionId: session.id, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "no reply");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "terminal", content: data.reply, created_at: new Date().toISOString() },
      ]);
      if (data.session) setSession((prev) => (prev ? { ...prev, messageCount: data.session.messageCount } : prev));
      if (data.session?.status === "closed") {
        setOutcome(data.outcome ?? null);
        setBalance(data.wallet?.balance ?? balance);
        setSession(null);
      }
    } catch {
      setError("connection lost");
    } finally {
      setBusy(false);
    }
  }

  async function closeEarly() {
    if (closing || !session) return;
    setClosing(true);
    setError(null);
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/undervoice", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "close", sessionId: session.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "could not close");
        return;
      }
      setOutcome(data.outcome ?? null);
      setBalance(data.wallet?.balance ?? balance);
      setSession(null);
    } catch {
      setError("connection lost");
    } finally {
      setClosing(false);
    }
  }

  if (!loaded) {
    return <p className="text-dim text-sm animate-pulse">reaching down...</p>;
  }

  if (config.paused) {
    return <p className="text-alert text-sm">[ signal lost — nothing is answering down here right now ]</p>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className={balance < config.sessionCost && !session ? "text-alert" : "text-dim"}>
          entry: {config.sessionCost} PROBLEMS · balance: {balance}
        </span>
        {session && (
          <span className="text-dim">
            [ session open · {session.messageCount}/{config.maxMessages} ]
          </span>
        )}
      </div>

      {outcome && (
        <p className="mb-3 text-xs text-problem" role="status">
          [ {OUTCOME_LINE[outcome.outcome](outcome.delta)} ]
        </p>
      )}

      {!session ? (
        <div className="space-y-3">
          <p className="text-dim text-sm">
            something is down there. it doesn&apos;t talk much. reaching it costs {config.sessionCost}{" "}
            PROBLEMS — what happens after that depends on how the conversation actually goes.
          </p>
          <button
            type="button"
            onClick={openSession}
            disabled={opening || balance < config.sessionCost}
            className="border border-terminal text-terminal px-3 py-1.5 text-sm hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
          >
            {opening ? "opening..." : `[ spend ${config.sessionCost} to open a session ]`}
          </button>
          {balance < config.sessionCost && (
            <p className="text-ghost text-xs">not enough PROBLEMS yet — mine more at the main terminal.</p>
          )}
        </div>
      ) : (
        <>
          <Meter
            fraction={session.messageCount / config.maxMessages}
            label={`session: ${session.messageCount}/${config.maxMessages}`}
          />
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 my-3 max-h-80 pr-1">
            {messages.length === 0 && <p className="text-dim text-sm">undervoice&gt; ...</p>}
            {messages.map((m, i) => (
              <p
                key={i}
                className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  m.role === "terminal" ? "text-terminal" : "text-you"
                }`}
              >
                <span className="text-dim">{m.role === "terminal" ? "undervoice> " : "you> "}</span>
                {m.content}
              </p>
            ))}
            {busy && <p className="text-dim text-sm animate-pulse">undervoice&gt; ...</p>}
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
          <button
            type="button"
            onClick={closeEarly}
            disabled={closing}
            className="mt-2 self-start text-ghost hover:text-terminal transition-colors text-xs disabled:opacity-40"
          >
            [ {closing ? "closing..." : "close session now"} ]
          </button>
        </>
      )}
      {error && !session && <p className="text-alert text-xs mt-2">[ {error} ]</p>}
    </div>
  );
}
