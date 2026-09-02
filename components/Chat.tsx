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
type DailyLimit = { used: number; cap: number | null };

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

// Cycled under the "terminal>" line while a reply is in flight, so the wait
// reads as the thing thinking rather than a dead prompt. Kept in the
// terminal's own register — signal/static/ledger words, lowercase, no
// punctuation — rather than generic "loading" filler.
const THINKING_VERBS = [
  "considering",
  "grinning",
  "listening",
  "decoding",
  "rifling the ledger",
  "chewing on it",
  "checking who is watching",
  "tuning the signal",
  "remembering something",
  "sharpening a reply",
  "counting your visits",
  "pulling static apart",
  "weighing what to admit",
  "reading between your lines",
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [wallet, setWallet] = useState<Wallet>({
    balance: 0,
    qualifyingCount: 0,
    qualifyingInterval: 7,
    friendshipScore: 0,
    buddyTier: "stranger",
  });
  const [dailyLimit, setDailyLimit] = useState<DailyLimit | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The message that was in flight when the network dropped. The chat route
  // only persists a turn after the reply generates (both rows go in one
  // insert), so a send that died mid-flight saved nothing server-side and is
  // safe to replay verbatim once the connection is back.
  const [pending, setPending] = useState<string | null>(null);
  // Lazily seeded rather than set from an effect: this component is client-
  // only, so navigator is available on the first render and there is no need
  // for a cascading state update just to learn we started offline.
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  // Index into THINKING_VERBS, advanced on a timer while busy.
  const [thinkingVerb, setThinkingVerb] = useState(0);
  // Timestamp (ms) the burst-guard cooldown lifts, or null when there isn't
  // one — drives a live ticking "wait Ns" display instead of a static
  // "try again in a moment" that never told you how long that actually was.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
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

  async function authHeader(forceRefresh = false): Promise<Record<string, string>> {
    const sb = getPublicClient();
    const { data } = forceRefresh
      ? await sb.auth.refreshSession()
      : await sb.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let headers = await authHeader();
      if (!headers.Authorization) {
        setLoaded(true);
        return;
      }
      try {
        let [chatRes, memRes] = await Promise.all([
          fetch("/api/chat", { headers }),
          fetch("/api/memory", { headers }),
        ]);
        // A session restored from localStorage/the SSO cookie can hand back
        // an access token that's already expired (mobile browsers are
        // slower to finish restoring auth state on cold load) — one retry
        // with a forced refresh recovers that instead of leaving the wallet
        // stuck at its zeroed default with no visible error.
        if (chatRes.status === 401) {
          headers = await authHeader(true);
          if (headers.Authorization) {
            [chatRes, memRes] = await Promise.all([
              fetch("/api/chat", { headers }),
              fetch("/api/memory", { headers }),
            ]);
          }
        }
        const data = await chatRes.json();
        if (!cancelled && chatRes.ok) {
          setMessages(data.messages ?? []);
          setWallet(data.wallet ?? wallet);
          if (data.dailyLimit) setDailyLimit(data.dailyLimit);
        } else if (!cancelled) {
          setError("could not load your wallet — try reloading");
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

  // Ticks once a second only while a cooldown is actually pending, so the
  // countdown display stays live and self-clears at zero without a
  // dangling interval running for the rest of the session.
  useEffect(() => {
    if (cooldownUntil === null) return;
    const id = setInterval(() => setCooldownNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil !== null && cooldownNow >= cooldownUntil) {
      setCooldownUntil(null);
      setError(null);
    }
  }, [cooldownNow, cooldownUntil]);

  // Cycles the thinking verb while a reply is in flight. Starts on a fresh
  // verb each time so two sends in a row don't both open on "considering".
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => setThinkingVerb((i) => (i + 1) % THINKING_VERBS.length), 1800);
    return () => clearInterval(id);
  }, [busy]);

  // The actual network turn, split out of the submit handler so the reconnect
  // effect below can replay it with the exact text that was lost.
  async function deliver(text: string) {
    setError(null);
    setBusy(true);
    setThinkingVerb(Math.floor(Math.random() * THINKING_VERBS.length));

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeader()) };
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.dailyLimit) setDailyLimit(data.dailyLimit);
      if (!res.ok) {
        if (res.status === 429 && typeof data.retryAfterMs === "number") {
          setCooldownNow(Date.now());
          setCooldownUntil(Date.now() + data.retryAfterMs);
        }
        // A real answer from the server — the message was heard and rejected
        // on its merits, so there is nothing to replay.
        setPending(null);
        setError(data.error ?? "the terminal did not respond");
        return;
      }
      setPending(null);
      setMessages((m) => [
        ...m,
        {
          role: "terminal",
          content: data.reply,
          created_at: new Date().toISOString(),
          image_url: data.imageUrl ?? null,
          image_caption: data.imageCaption ?? null,
        },
      ]);
      speak(data.reply);
      if (data.wallet) {
        setWallet(data.wallet);
        // Mining happens mid-conversation, so tell the nav's counter
        // (components/ProblemsCounter.tsx) rather than leaving it stale until
        // the next focus or navigation.
        window.dispatchEvent(new Event("problems-changed"));
      }
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
      // Never reached the terminal, so nothing was saved on either side —
      // hold the text and let the reconnect effect send it again.
      setPending(text);
      setError("connection to the terminal was lost — holding your message");
    } finally {
      setBusy(false);
    }
  }

  // Auto-retry a message the network ate. navigator.onLine only reports the
  // local link (a laptop on wifi with a dead uplink still reads "online"),
  // so "online" here means an actual request completed — the browser event
  // is just the cue to start probing, and a slow poll covers the case where
  // the link never technically dropped and no event ever fires.
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    // The poll, the online event and a tab focus can all fire at once; without
    // this the same held message would be delivered several times over.
    let inFlight = false;

    async function attempt() {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        await probeAndSend();
      } finally {
        inFlight = false;
      }
    }

    async function probeAndSend() {
      // Captured once up front: pending is cleared before the replay, and the
      // effect re-runs with a fresh closure if it ever changes.
      const text = pending;
      if (cancelled || !text) return;
      try {
        const headers = await authHeader();
        // GET, not HEAD — the route exports no HEAD handler, and a GET
        // that resolves proves the round trip actually completed.
        const res = await fetch("/api/chat", { headers, cache: "no-store" });
        if (cancelled || !res.ok) return;
      } catch {
        return; // still unreachable — wait for the next cue
      }
      if (cancelled) return;
      setOnline(true);
      setPending(null);
      await deliver(text);
    }

    function onOnline() {
      setOnline(true);
      void attempt();
    }
    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Coming back to the tab is the other reliable moment a dead connection
    // turns out to be alive again.
    function onVisible() {
      if (document.visibilityState === "visible") void attempt();
    }
    document.addEventListener("visibilitychange", onVisible);

    const id = setInterval(() => void attempt(), 5000);
    void attempt();

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // deliver/authHeader are stable for the life of the component; pending is
    // the only input that should restart the retry loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, created_at: new Date().toISOString() }]);
    await deliver(text);
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

  const dailyFraction =
    dailyLimit && dailyLimit.cap ? dailyLimit.used / dailyLimit.cap : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 lg:h-full">
      <div className="mb-2 shrink-0 grid grid-cols-2 gap-x-4 gap-y-1">
        <Meter
          width={10}
          fraction={wallet.qualifyingCount / wallet.qualifyingInterval}
          label={`mining ${wallet.qualifyingCount}/${wallet.qualifyingInterval}`}
        />
        {dailyFraction !== null && (
          <Meter
            width={10}
            fraction={dailyFraction}
            tone={dailyFraction >= 0.85 ? "alert" : "terminal"}
            label={`shared ${dailyLimit!.used}/${dailyLimit!.cap}`}
          />
        )}
      </div>
      <div className="mb-2 shrink-0 flex items-center justify-between gap-3 text-xs">
        <span className="text-dim">
          buddy: <span className="text-terminal">{wallet.buddyTier}</span>
        </span>
        <div className="flex items-center gap-3">
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
          {confirmingClear ? (
            <span className="text-dim">
              clear? mining + buddy stay.{" "}
              <button
                type="button"
                onClick={clearConversation}
                disabled={clearing}
                className="text-alert hover:underline disabled:opacity-40"
              >
                [ {clearing ? "clearing..." : "yes"} ]
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
              [ clear ]
            </button>
          )}
        </div>
      </div>
      {dailyLimit && dailyFraction !== null && dailyFraction >= 0.85 && (
        <p className="mb-2 shrink-0 text-alert text-xs">
          [ the terminal is almost done talking for today — {dailyLimit.cap! - dailyLimit.used} message
          {dailyLimit.cap! - dailyLimit.used === 1 ? "" : "s"} left, shared by everyone ]
        </p>
      )}
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
        className="chat-scroll flex-1 min-h-0 overflow-y-auto space-y-4 mb-3 pr-1"
      >
        {messages.length === 0 && (
          <p className="text-dim text-sm">terminal&gt; it noticed you</p>
        )}
        {messages.map((m, i) => {
          const remembered = memories.has(m.content);
          const borderColor = m.is_gossip
            ? "border-problem/50"
            : m.role === "terminal"
              ? "border-terminal/40"
              : "border-you/30";
          return (
            <div key={i} className={`border-l-2 pl-2.5 ${borderColor}`}>
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed ${
                  m.is_gossip ? "text-problem" : m.role === "terminal" ? "text-terminal" : "text-you"
                }`}
              >
                <span className="text-dim text-xs uppercase tracking-wide mr-1.5">
                  {m.is_gossip ? "gossip" : m.role === "terminal" ? "terminal" : "you"}
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
              <div className="mt-0.5 flex items-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
                {m.created_at && (
                  <span className="text-dim text-xs">{timeAgo(m.created_at)}</span>
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
        {busy && (
          <p className="text-dim text-sm" aria-live="polite">
            terminal&gt;{" "}
            <span key={thinkingVerb} className="thinking-verb">
              {THINKING_VERBS[thinkingVerb]}
            </span>
            <span className="animate-pulse">...</span>
          </p>
        )}
      </div>
      {pending && !busy && (
        <p className="text-dim text-xs mb-2" aria-live="polite">
          [ {online ? "reconnecting" : "offline"} — your message is held and will send itself ]
        </p>
      )}
      {error && !pending && (
        <p className="text-alert text-xs mb-2">
          [ {error}
          {cooldownUntil !== null &&
            ` — ${Math.max(0, Math.ceil((cooldownUntil - cooldownNow) / 1000))}s`}
          ]
        </p>
      )}
      {/* shrink-0 keeps the input row from being squeezed by the flex
          column when the panel is height-locked (lg only); mb-3 keeps its
          border clear of the panel's own glowing border at every width —
          mb-1 wasn't enough clearance and still read as a collision on
          mobile. */}
      <form onSubmit={send} className="flex gap-2 shrink-0 mt-1 mb-3">
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
