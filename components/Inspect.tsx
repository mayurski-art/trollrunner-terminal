"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { renderTightLines } from "@/lib/renderText";

type UserRow = {
  userId: string;
  username: string;
  balance: number;
  friendshipScore: number;
  liveUndervoice: boolean;
  lastActiveAt: string | null;
};

type ChatMsg = {
  role: "user" | "terminal";
  content: string;
  created_at: string;
  is_gossip: boolean;
  image_url: string | null;
  image_caption: string | null;
};

type BugReport = {
  id: string;
  message: string;
  reporterUsername: string | null;
  userAgent: string | null;
  status: "open" | "resolved";
  createdAt: string;
};

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
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [bugReportBusy, setBugReportBusy] = useState<string | null>(null);
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

  async function loadBugReports() {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    const res = await fetch("/api/admin/bug-reports", { headers });
    const data = await res.json();
    if (res.ok) setBugReports(data.reports ?? []);
  }

  async function resolveBugReport(id: string, status: BugReport["status"]) {
    if (bugReportBusy) return;
    setBugReportBusy(id);
    try {
      const headers = await authHeader();
      if (!headers.Authorization) return;
      const res = await fetch("/api/admin/bug-reports", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) await loadBugReports();
      else {
        const data = await res.json();
        setError(data.error ?? "could not update the report");
      }
    } catch {
      setError("connection lost");
    } finally {
      setBugReportBusy(null);
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadUsers(), loadLive(), loadBugReports()]);
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
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full">
      <div className="lg:w-64 shrink-0 space-y-1.5 max-h-[45vh] lg:max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
        {users.length === 0 && <p className="text-dim text-sm">nobody&apos;s talked to it yet</p>}
        {users.map((u) => {
          const live = liveUserIds.has(u.userId);
          return (
            <button
              key={u.userId}
              type="button"
              onClick={() => openUser(u.userId)}
              className={`w-full text-left text-base px-3 py-2.5 border transition-colors ${
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
              <span className="block text-ghost text-sm">
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
              <div ref={scrollRef} className="space-y-3 max-h-[55vh] lg:max-h-[calc(100vh-18rem)] overflow-y-auto pr-1">
                {chatMessages.length === 0 && <p className="text-dim text-sm">no messages</p>}
                {chatMessages.map((m, i) => (
                  <div key={i}>
                    <p
                      className={`text-base leading-relaxed ${
                        m.is_gossip ? "text-problem" : m.role === "terminal" ? "text-terminal" : "text-you"
                      }`}
                    >
                      <span className="text-dim">
                        {m.is_gossip ? "gossip> " : m.role === "terminal" ? "terminal> " : "user> "}
                      </span>
                      {renderTightLines(m.content)}
                      <span className="text-ghost text-xs ml-2">{timeAgo(m.created_at)}</span>
                    </p>
                    {m.image_url && (
                      <div className="mt-1 ml-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={m.image_url}
                          alt={m.image_caption ?? "lore image"}
                          className="max-h-64 sm:max-h-80 border border-dim"
                        />
                        {m.image_caption && (
                          <p className="text-ghost text-xs mt-0.5">{m.image_caption}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>

      <div className="lg:w-96 shrink-0 space-y-2">
        <p className="text-ghost text-xs">[ bug reports ]</p>
        <div className="space-y-2 max-h-[50vh] lg:max-h-[28rem] overflow-y-auto pr-1">
          {bugReports.length === 0 && <p className="text-dim text-sm">nothing filed yet</p>}
          {bugReports.map((r) => (
            <div key={r.id} className="border border-dim px-3 py-2 text-sm space-y-1.5">
              <p className="text-you leading-snug">{renderTightLines(r.message)}</p>
              <div className="flex items-end justify-between gap-3">
                <p className="text-ghost">
                  {r.reporterUsername ?? "guest"} · {timeAgo(r.createdAt)}
                  {r.status === "resolved" && <span className="text-gain"> · resolved</span>}
                </p>
                {r.status !== "resolved" ? (
                  <button
                    type="button"
                    disabled={bugReportBusy === r.id}
                    onClick={() => resolveBugReport(r.id, "resolved")}
                    className="shrink-0 border border-alert text-alert px-2 py-1 hover:bg-alert hover:text-background transition-colors disabled:opacity-40"
                  >
                    resolve
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={bugReportBusy === r.id}
                    onClick={() => resolveBugReport(r.id, "open")}
                    className="shrink-0 text-ghost hover:text-dim transition-colors disabled:opacity-40"
                  >
                    undo
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
