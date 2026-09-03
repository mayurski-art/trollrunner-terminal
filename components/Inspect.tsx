"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";

type UserRow = {
  userId: string;
  username: string;
  balance: number;
  friendshipScore: number;
  liveUndervoice: boolean;
  lastActiveAt: string | null;
};

type ChatMsg = { role: "user" | "terminal"; content: string; created_at: string; is_gossip: boolean };

const LIVE_POLL_MS = 5000;

async function authHeader(): Promise<Record<string, string>> {
  const sb = getPublicClient();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function Inspect() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [liveUserIds, setLiveUserIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadUsers() {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    const res = await fetch("/api/admin/users", { headers });
    const data = await res.json();
    if (res.ok) setUsers(data.users ?? []);
    else setError(data.error ?? "could not load users");
  }

  async function loadLive() {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    const res = await fetch("/api/admin/live", { headers });
    const data = await res.json();
    if (res.ok) {
      type LiveRow = { userId: string };
      setLiveUserIds(new Set((data.live ?? []).map((l: LiveRow) => l.userId)));
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadUsers(), loadLive()]);
      setLoaded(true);
    })();
    const interval = setInterval(loadLive, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function openUser(userId: string) {
    setSelected(userId);
    setLoadingConvo(true);
    setError(null);
    try {
      const headers = await authHeader();
      const res = await fetch(`/api/admin/conversations?userId=${encodeURIComponent(userId)}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "could not load conversation");
        return;
      }
      setChatMessages(data.chatMessages ?? []);
    } catch {
      setError("connection lost");
    } finally {
      setLoadingConvo(false);
    }
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [chatMessages]);

  if (!loaded) {
    return <p className="text-dim text-sm animate-pulse">pulling the wire...</p>;
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 h-full">
      <div className="sm:w-56 shrink-0 space-y-1 max-h-96 overflow-y-auto pr-1">
        {users.length === 0 && <p className="text-dim text-sm">nobody&apos;s talked to it yet</p>}
        {users.map((u) => {
          const live = liveUserIds.has(u.userId);
          return (
            <button
              key={u.userId}
              type="button"
              onClick={() => openUser(u.userId)}
              className={`w-full text-left text-xs px-2 py-1.5 border transition-colors ${
                selected === u.userId
                  ? "border-terminal text-terminal"
                  : "border-dim text-dim hover:border-terminal hover:text-terminal"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{u.username}</span>
                {live && (
                  <span className="text-problem" aria-label="live now">
                    ●
                  </span>
                )}
              </span>
              <span className="block text-ghost">
                {u.lastActiveAt ? timeAgo(u.lastActiveAt) : "no activity"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0">
        {error && <p className="text-alert text-xs mb-2">[ {error} ]</p>}
        {!selected && <p className="text-dim text-sm">pick a user to inspect</p>}
        {selected && loadingConvo && <p className="text-dim text-sm animate-pulse">loading...</p>}
        {selected && !loadingConvo && (
          <div className="space-y-6">
            <div>
              <p className="text-ghost text-xs mb-2">[ main terminal ]</p>
              <div ref={scrollRef} className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {chatMessages.length === 0 && <p className="text-dim text-sm">no messages</p>}
                {chatMessages.map((m, i) => (
                  <p
                    key={i}
                    className={`whitespace-pre-wrap text-sm leading-relaxed ${
                      m.is_gossip ? "text-problem" : m.role === "terminal" ? "text-terminal" : "text-you"
                    }`}
                  >
                    <span className="text-dim">
                      {m.is_gossip ? "gossip> " : m.role === "terminal" ? "terminal> " : "user> "}
                    </span>
                    {m.content}
                    <span className="text-ghost text-xs ml-2">{timeAgo(m.created_at)}</span>
                  </p>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
