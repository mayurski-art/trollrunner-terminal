"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import Meter from "@/components/Meter";
import { timeAgo } from "@/lib/time";
import { isVideoAsset } from "@/lib/loreAssets";

type Message = {
  role: "user" | "terminal";
  content: string;
  created_at?: string;
  is_gossip?: boolean;
  image_url?: string | null;
  image_caption?: string | null;
};
type Wallet = {
  balance: number;
  qualifyingCount: number;
  qualifyingInterval: number;
  friendshipScore: number;
  buddyTier: string;
};

const VOICE_PREF_KEY = "terminal_voice_enabled";

// Strips the ASCII/markdown dressing the terminal writes in (box chars,
// asterisks, backticks) so narration reads as speech, not symbol soup.
function speakableText(text: string): string {
  return text
    .replace(/[*_`#>|~]/g, "")
    .replace(/https?:\/\/\S+/g, "link")
    .replace(/\s+/g, " ")
    .trim();
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [wallet, setWallet] = useState<Wallet>({
    balance: 0,
    qualifyingCount: 0,
    qualifyingInterval: 7,
    friendshipScore: 0,
    buddyTier: "stranger",
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [buddyToast, setBuddyToast] = useState<string | null>(null);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);
  // content -> memory id, so the button can double as remember/forget and
  // survive a page reload showing which lines are already pinned.
  const [memories, setMemories] = useState<Map<string, string>>(new Map());
  const [memoryBusy, setMemoryBusy] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; caption?: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lightbox) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  useEffect(() => {
    // Deliberately deferred to after hydration — window/localStorage reads
    // would mismatch the server-rendered HTML if done during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoiceSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    try {
      setVoiceOn(localStorage.getItem(VOICE_PREF_KEY) === "1");
    } catch {
      // ignore — voice defaults to off
    }
  }, []);

  function speak(text: string) {
    if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = speakableText(text);
    if (!clean) return;
    window.speechSynthesis.cancel(); // don't stack replies on top of each other
    const utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1;
    utter.pitch = 0.85;
    window.speechSynthesis.speak(utter);
  }

  function toggleVoice() {
    setVoiceOn((prev) => {
      const next = !prev;
      if (!next && typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      try {
        localStorage.setItem(VOICE_PREF_KEY, next ? "1" : "0");
      } catch {
        // ignore — pref just won't persist
      }
      return next;
    });
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

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
        const [chatRes, memRes] = await Promise.all([
          fetch("/api/chat", { headers }),
          fetch("/api/memory", { headers }),
        ]);
        const data = await chatRes.json();
        if (!cancelled && chatRes.ok) {
          setMessages(data.messages ?? []);
          setWallet(data.wallet ?? wallet);
        }
        const memData = await memRes.json();
        if (!cancelled && memRes.ok) {
          type MemoryRow = { id: string; content: string };
          setMemories(new Map((memData.memories ?? []).map((r: MemoryRow) => [r.content, r.id])));
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
        {
          role: "terminal",
          content: data.reply,
          created_at: new Date().toISOString(),
          image_url: data.imageUrl ?? null,
          image_caption: data.imageCaption ?? null,
        },
        ...(data.gossip?.content
          ? [
              {
                role: "terminal" as const,
                content: data.gossip.content,
                created_at: new Date().toISOString(),
                is_gossip: true,
              },
            ]
          : []),
      ]);
      speak(data.reply);
      if (data.wallet) setWallet(data.wallet);
      if (data.buddyBonus > 0) {
        setBuddyToast(
          `+${data.buddyBonus} bonus PROBLEM${data.buddyBonus === 1 ? "" : "S"} · the terminal is warming up to you`
        );
        setTimeout(() => setBuddyToast(null), 5000);
      }
      if (data.archiveUnlock) {
        setArchiveToast(
          `file ${String(data.archiveUnlock.section).padStart(2, "0")} recovered · ${data.archiveUnlock.title}`
        );
        setTimeout(() => setArchiveToast(null), 6000);
      }
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusy(false);
    }
  }

  // Clears the chat transcript only — wallet balance, mining progress, and
  // buddy/friendship level live in a separate table and are untouched.
  async function clearConversation() {
    if (clearing) return;
    setClearing(true);
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch("/api/chat", { method: "DELETE", headers });
      if (!res.ok) {
        setError("could not clear the conversation");
        return;
      }
      setMessages([]);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setClearing(false);
      setConfirmingClear(false);
    }
  }

  async function toggleMemory(m: Message) {
    if (memoryBusy) return;
    const existingId = memories.get(m.content);
    setMemoryBusy(m.content);
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      if (existingId) {
        await fetch(`/api/memory?id=${encodeURIComponent(existingId)}`, { method: "DELETE", headers });
        setMemories((prev) => {
          const next = new Map(prev);
          next.delete(m.content);
          return next;
        });
      } else {
        const res = await fetch("/api/memory", {
          method: "POST",
          headers,
          body: JSON.stringify({ content: m.content, role: m.role }),
        });
        const data = await res.json();
        if (res.ok && data.memory?.id) {
          setMemories((prev) => new Map(prev).set(m.content, data.memory.id));
        }
      }
    } finally {
      setMemoryBusy(null);
    }
  }

  if (!loaded) {
    return <p className="text-dim text-sm animate-pulse">establishing uplink...</p>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-2 flex items-center justify-between gap-3">
        <Meter
          fraction={wallet.qualifyingCount / wallet.qualifyingInterval}
          label={`mining: ${wallet.qualifyingCount}/${wallet.qualifyingInterval}`}
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Disable voice narration" : "Enable voice narration"}
            className="shrink-0 border border-dim text-dim px-2 py-0.5 text-xs hover:border-terminal hover:text-terminal transition-colors data-[on=true]:border-terminal data-[on=true]:text-terminal"
            data-on={voiceOn}
          >
            [ voice: {voiceOn ? "on" : "off"} ]
          </button>
        )}
      </div>
      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-dim">
          buddy: <span className="text-terminal">{wallet.buddyTier}</span>
        </span>
        {confirmingClear ? (
          <span className="text-dim">
            clear this conversation? mining + buddy progress stay.{" "}
            <button
              type="button"
              onClick={clearConversation}
              disabled={clearing}
              className="text-alert hover:underline disabled:opacity-40"
            >
              [ {clearing ? "clearing..." : "yes, clear"} ]
            </button>{" "}
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              disabled={clearing}
              className="text-ghost hover:text-terminal transition-colors disabled:opacity-40"
            >
              [ cancel ]
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            disabled={messages.length === 0}
            aria-label="Clear this conversation"
            className="text-ghost hover:text-terminal transition-colors disabled:opacity-40"
          >
            [ clear conversation ]
          </button>
        )}
      </div>
      {buddyToast && (
        <p className="mb-2 text-xs text-problem" role="status">
          [ {buddyToast} ]
        </p>
      )}
      {archiveToast && (
        <p className="mb-2 text-xs text-terminal" role="status">
          [ ▣ {archiveToast} ]
        </p>
      )}
      <div
        ref={scrollRef}
        className="chat-scroll flex-1 overflow-y-auto space-y-3 mb-3 max-h-[32rem] pr-1"
      >
        {messages.length === 0 && (
          <p className="text-dim text-sm">terminal&gt; it noticed you</p>
        )}
        {messages.map((m, i) => {
          const remembered = memories.has(m.content);
          return (
            <div key={i}>
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  m.is_gossip ? "text-problem" : m.role === "terminal" ? "text-terminal" : "text-you"
                }`}
              >
                <span className="text-dim">
                  {m.is_gossip ? "gossip> " : m.role === "terminal" ? "terminal> " : "you> "}
                </span>
                {m.content}
              </p>
              {m.image_url && isVideoAsset(m.image_url) && (
                <div className="mt-2 max-w-xs border border-dim">
                  <video
                    src={m.image_url}
                    controls
                    playsInline
                    className="w-full block"
                    aria-label={m.image_caption ?? "clip sent by the terminal"}
                  />
                  {m.image_caption && <p className="text-dim text-xs px-1.5 py-1">{m.image_caption}</p>}
                </div>
              )}
              {m.image_url && !isVideoAsset(m.image_url) && (
                <div className="mt-2 max-w-xs border border-dim">
                  <button
                    type="button"
                    onClick={() => setLightbox({ url: m.image_url!, caption: m.image_caption })}
                    aria-label="View full-size image"
                    className="block w-full cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image_url}
                      alt={m.image_caption ?? "image sent by the terminal"}
                      className="w-full block"
                    />
                  </button>
                  {m.image_caption && <p className="text-dim text-xs px-1.5 py-1">{m.image_caption}</p>}
                </div>
              )}
              <div className="flex items-center gap-2">
                {m.created_at && (
                  <span className="text-terminal text-xs">{timeAgo(m.created_at)}</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleMemory(m)}
                  disabled={memoryBusy === m.content}
                  aria-pressed={remembered}
                  aria-label={remembered ? "Forget this message" : "Remember this message"}
                  className={`text-xs disabled:opacity-40 ${
                    remembered ? "text-problem" : "text-ghost hover:text-terminal transition-colors"
                  }`}
                >
                  [ {remembered ? "remembered" : "remember"} ]
                </button>
              </div>
            </div>
          );
        })}
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
          className="glitch-btn border border-terminal text-terminal px-3 text-sm hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
        >
          &gt;
        </button>
      </form>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.caption ?? "image sent by the terminal"}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 p-6 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.caption ?? "image sent by the terminal"}
            className="max-h-[85vh] max-w-full object-contain border border-dim"
          />
          {lightbox.caption && <p className="text-dim text-sm">{lightbox.caption}</p>}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            className="text-ghost hover:text-terminal transition-colors text-xs"
          >
            [ close ]
          </button>
        </div>
      )}
    </div>
  );
}
