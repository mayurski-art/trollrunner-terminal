"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { timeAgo } from "@/lib/time";
import { renderTightLines } from "@/lib/renderText";
import { shortenAddress } from "@/lib/solanaAddress";

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

type WalletSubmission = {
  id: string;
  username: string;
  address: string;
  status: "pending" | "airdropped" | "skipped";
  amountTroll: number | null;
  txSignature: string | null;
  note: string | null;
  createdAt: string;
  problemsBalance: number;
  problemsEarned: number;
};

type Round = {
  id: string;
  problemsPerTroll: number;
  poolTroll: number;
  perUserCap: number | null;
  isOpen: boolean;
  label: string | null;
  committedTroll: number;
};

type RedemptionRequest = {
  id: string;
  username: string;
  problemsSpent: number;
  rateAtRequest: number;
  owedTroll: number;
  address: string;
  status: "pending" | "paid" | "refunded";
  amountTroll: number | null;
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
  const [submissions, setSubmissions] = useState<WalletSubmission[]>([]);
  const [payoutInputs, setPayoutInputs] = useState<Record<string, string>>({});
  const [submissionBusy, setSubmissionBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [redemptions, setRedemptions] = useState<RedemptionRequest[]>([]);
  const [redemptionBusy, setRedemptionBusy] = useState<string | null>(null);
  const [newRate, setNewRate] = useState("69");
  const [newPool, setNewPool] = useState("175");
  const [newCap, setNewCap] = useState("500");
  const [newLabel, setNewLabel] = useState("");
  const [roundBusy, setRoundBusy] = useState(false);
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

  async function loadSubmissions() {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    const res = await fetch("/api/admin/wallet-submissions", { headers });
    const data = await res.json();
    if (res.ok) setSubmissions(data.submissions ?? []);
  }

  // Records a transfer the operator already made by hand — this never sends
  // anything. Amount and signature are optional; the status is the point.
  async function reviewSubmission(id: string, status: WalletSubmission["status"]) {
    if (submissionBusy) return;
    setSubmissionBusy(id);
    try {
      const headers = await authHeader();
      if (!headers.Authorization) return;
      const raw = (payoutInputs[id] ?? "").trim();
      const res = await fetch("/api/admin/wallet-submissions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, amountTroll: raw === "" ? null : Number(raw) }),
      });
      if (res.ok) {
        setPayoutInputs((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await loadSubmissions();
      } else {
        const data = await res.json();
        setError(data.error ?? "could not update submission");
      }
    } catch {
      setError("connection lost");
    } finally {
      setSubmissionBusy(null);
    }
  }

  const openRound = rounds.find((r) => r.isOpen) ?? null;

  async function copyAddress(id: string, address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard can be blocked; the address is selectable on screen anyway.
    }
  }

  async function loadRedemptions() {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    const res = await fetch("/api/admin/redemptions", { headers });
    const data = await res.json();
    if (res.ok) {
      setRounds(data.rounds ?? []);
      setRedemptions(data.requests ?? []);
    }
  }

  // "pay" records a transfer already made by hand; "refund" returns the
  // user's PROBLEMS. Neither sends anything.
  async function reviewRedemption(
    id: string,
    action: "pay" | "refund" | "unreview",
    amountTroll?: number
  ) {
    if (redemptionBusy) return;
    setRedemptionBusy(id);
    try {
      const headers = await authHeader();
      if (!headers.Authorization) return;
      const res = await fetch("/api/admin/redemptions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, amountTroll: amountTroll ?? null }),
      });
      if (res.ok) await loadRedemptions();
      else {
        const data = await res.json();
        setError(data.error ?? "could not update request");
      }
    } catch {
      setError("connection lost");
    } finally {
      setRedemptionBusy(null);
    }
  }

  async function manageRound(action: "open_round" | "close_round") {
    if (roundBusy) return;
    setRoundBusy(true);
    try {
      const headers = await authHeader();
      if (!headers.Authorization) return;
      const body =
        action === "open_round"
          ? {
              action,
              problemsPerTroll: Number(newRate),
              poolTroll: Number(newPool),
              perUserCap: newCap.trim() === "" ? null : Number(newCap),
              label: newLabel.trim(),
            }
          : { action };
      const res = await fetch("/api/admin/redemptions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await loadRedemptions();
      else {
        const data = await res.json();
        setError(data.error ?? "could not update the round");
      }
    } catch {
      setError("connection lost");
    } finally {
      setRoundBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([
        loadUsers(),
        loadLive(),
        loadBugReports(),
        loadSubmissions(),
        loadRedemptions(),
      ]);
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
                  <div key={i}>
                    <p
                      className={`text-sm leading-snug ${
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
                          className="max-h-40 border border-dim"
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

      <div className="sm:w-72 shrink-0 space-y-2">
        <p className="text-ghost text-xs">
          [ wallet submissions ]
          {submissions.some((s) => s.status === "pending") && (
            <span className="text-problem">
              {" "}
              · {submissions.filter((s) => s.status === "pending").length} pending
            </span>
          )}
        </p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {submissions.length === 0 && (
            <p className="text-dim text-sm">no addresses submitted yet</p>
          )}
          {submissions.map((s) => (
            <div key={s.id} className="border border-dim px-2 py-1.5 text-xs space-y-1">
              <p className="text-you">
                {s.username}
                <span className="text-ghost">
                  {" "}
                  · {s.problemsBalance} PROBLEMS ({s.problemsEarned} earned)
                </span>
              </p>
              <button
                type="button"
                onClick={() => copyAddress(s.id, s.address)}
                title={s.address}
                className="font-mono text-problem break-all text-left hover:text-terminal transition-colors"
              >
                {shortenAddress(s.address, 6, 6)}
                <span className="text-ghost"> {copiedId === s.id ? "[copied]" : "[copy]"}</span>
              </button>
              <p className="text-ghost">
                {timeAgo(s.createdAt)}
                {s.status === "airdropped" && (
                  <span className="text-gain">
                    {" "}
                    · airdropped{s.amountTroll ? ` ${s.amountTroll} TROLL` : ""}
                  </span>
                )}
                {s.status === "skipped" && <span className="text-ghost"> · skipped</span>}
              </p>
              {s.status === "pending" && (
                <div className="flex gap-1 pt-0.5">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={payoutInputs[s.id] ?? ""}
                    onChange={(e) =>
                      setPayoutInputs((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="TROLL"
                    className="w-16 bg-transparent border border-dim px-1 py-0.5 text-xs text-problem outline-none focus:border-problem"
                  />
                  <button
                    type="button"
                    disabled={submissionBusy === s.id}
                    onClick={() => reviewSubmission(s.id, "airdropped")}
                    className="border border-gain text-gain px-1.5 hover:bg-gain hover:text-background transition-colors disabled:opacity-40"
                  >
                    sent
                  </button>
                  <button
                    type="button"
                    disabled={submissionBusy === s.id}
                    onClick={() => reviewSubmission(s.id, "skipped")}
                    className="border border-dim text-dim px-1.5 hover:border-alert hover:text-alert transition-colors disabled:opacity-40"
                  >
                    skip
                  </button>
                </div>
              )}
              {s.status !== "pending" && (
                <button
                  type="button"
                  disabled={submissionBusy === s.id}
                  onClick={() => reviewSubmission(s.id, "pending")}
                  className="text-ghost hover:text-dim transition-colors disabled:opacity-40"
                >
                  undo
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-ghost text-xs pt-2">
          [ redemption round ]
          {redemptions.some((r) => r.status === "pending") && (
            <span className="text-problem">
              {" "}
              · {redemptions.filter((r) => r.status === "pending").length} pending
            </span>
          )}
        </p>
        <div className="border border-dim px-2 py-1.5 text-xs space-y-1.5">
          {openRound ? (
            <>
              <p className="text-you">
                {openRound.problemsPerTroll} PROBLEMS = 1 TROLL
                {openRound.label && <span className="text-ghost"> · {openRound.label}</span>}
              </p>
              <p className="text-ghost">
                pool {openRound.committedTroll}/{openRound.poolTroll} TROLL committed
                {openRound.perUserCap !== null && <> · cap {openRound.perUserCap}/user</>}
              </p>
              <button
                type="button"
                disabled={roundBusy}
                onClick={() => manageRound("close_round")}
                className="border border-dim text-dim px-1.5 hover:border-alert hover:text-alert transition-colors disabled:opacity-40"
              >
                close round
              </button>
            </>
          ) : (
            <p className="text-ghost">no round open</p>
          )}

          <div className="flex gap-1 pt-1 border-t border-dim">
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              title="PROBLEMS per TROLL"
              placeholder="rate"
              className="w-12 bg-transparent border border-dim px-1 py-0.5 text-problem outline-none focus:border-problem"
            />
            <input
              type="number"
              value={newPool}
              onChange={(e) => setNewPool(e.target.value)}
              title="pool in TROLL"
              placeholder="pool"
              className="w-14 bg-transparent border border-dim px-1 py-0.5 text-problem outline-none focus:border-problem"
            />
            <input
              type="number"
              value={newCap}
              onChange={(e) => setNewCap(e.target.value)}
              title="per-user cap in PROBLEMS (blank = none)"
              placeholder="cap"
              className="w-12 bg-transparent border border-dim px-1 py-0.5 text-problem outline-none focus:border-problem"
            />
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              title="round name, shown on /vault (optional)"
              placeholder="label"
              className="w-16 min-w-0 bg-transparent border border-dim px-1 py-0.5 text-problem outline-none focus:border-problem"
            />
            <button
              type="button"
              disabled={roundBusy}
              onClick={() => manageRound("open_round")}
              className="border border-terminal text-terminal px-1.5 hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
            >
              open
            </button>
          </div>
          <p className="text-ghost">opening a round closes the current one.</p>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {redemptions.length === 0 && (
            <p className="text-dim text-sm">no redemption requests yet</p>
          )}
          {redemptions.map((r) => (
            <div key={r.id} className="border border-dim px-2 py-1.5 text-xs space-y-1">
              <p className="text-you">
                {r.username}
                <span className="text-ghost">
                  {" "}
                  · {r.problemsSpent} PROBLEMS @ {r.rateAtRequest}
                </span>
              </p>
              <p className="text-problem">owes {r.owedTroll} TROLL</p>
              <button
                type="button"
                onClick={() => copyAddress(r.id, r.address)}
                title={r.address}
                className="font-mono text-dim break-all text-left hover:text-terminal transition-colors"
              >
                {shortenAddress(r.address, 6, 6)}
                <span className="text-ghost"> {copiedId === r.id ? "[copied]" : "[copy]"}</span>
              </button>
              <p className="text-ghost">
                {timeAgo(r.createdAt)}
                {r.status === "paid" && (
                  <span className="text-gain"> · sent {r.amountTroll ?? r.owedTroll} TROLL</span>
                )}
                {r.status === "refunded" && <span className="text-ghost"> · refunded</span>}
              </p>
              {r.status === "pending" && (
                <div className="flex gap-1 pt-0.5">
                  <button
                    type="button"
                    disabled={redemptionBusy === r.id}
                    onClick={() => reviewRedemption(r.id, "pay", r.owedTroll)}
                    className="border border-gain text-gain px-1.5 hover:bg-gain hover:text-background transition-colors disabled:opacity-40"
                  >
                    sent {r.owedTroll}
                  </button>
                  <button
                    type="button"
                    disabled={redemptionBusy === r.id}
                    onClick={() => reviewRedemption(r.id, "refund")}
                    className="border border-dim text-dim px-1.5 hover:border-alert hover:text-alert transition-colors disabled:opacity-40"
                  >
                    refund
                  </button>
                </div>
              )}
              {r.status === "paid" && (
                <button
                  type="button"
                  disabled={redemptionBusy === r.id}
                  onClick={() => reviewRedemption(r.id, "unreview")}
                  className="text-ghost hover:text-dim transition-colors disabled:opacity-40"
                >
                  undo
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-ghost text-xs pt-2">[ bug reports ]</p>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {bugReports.length === 0 && <p className="text-dim text-sm">nothing filed yet</p>}
          {bugReports.map((r) => (
            <div key={r.id} className="border border-dim px-2 py-1.5 text-xs space-y-1">
              <p className="text-you leading-snug">{renderTightLines(r.message)}</p>
              <p className="text-ghost">
                {r.reporterUsername ?? "guest"} · {timeAgo(r.createdAt)}
                {r.status === "resolved" && <span className="text-gain"> · resolved</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
