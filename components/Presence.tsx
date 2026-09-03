"use client";

// "Who's online" pill, wired to the SAME Supabase presence room the main
// site's header pill, world.html's island roster, and maps.html/pfp.html
// share (trollrunner-site-presence) — same payload shape and the same
// localStorage viewerId, so this terminal's count/roster is the one live
// number for the whole site, not a separate headcount. Visuals are
// terminal-native (nav-neon pill + bracket-menu dropdown) rather than the
// light Apple-style popover the other sites use — see
// assets/js/troll-presence.js in the main repo for the shared engine this
// mirrors.
import { useCallback, useEffect, useRef, useState } from "react";
import { getPublicClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

const VIEWER_ID_KEY = "trollrunner_viewer_id_v1";
const VIEWER_CHANNEL = "trollrunner-site-presence";

type Viewer = {
  viewerId: string;
  userId: string | null;
  username: string | null;
  avatarUrl: string | null;
  level: number | null;
  onlineAt: string;
  trackedAt: string;
};

type Roster = {
  members: { viewerId: string; userId: string; username: string; level: number }[];
  guests: { viewerId: string; onlineAt: string; guestLabel: string }[];
  total: number;
};

function getViewerId(): string {
  try {
    const stored = localStorage.getItem(VIEWER_ID_KEY);
    if (stored) return stored;
    const made = crypto?.randomUUID ? crypto.randomUUID() : `viewer-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(VIEWER_ID_KEY, made);
    return made;
  } catch {
    return `viewer-${Math.random().toString(16).slice(2)}`;
  }
}

function emptyRoster(): Roster {
  return { members: [], guests: [{ viewerId: getViewerId(), onlineAt: "", guestLabel: "Guest001" }], total: 1 };
}

export default function Presence() {
  const [roster, setRoster] = useState<Roster>(emptyRoster);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof getPublicClient>["channel"]> | null>(null);
  const profileRef = useRef<{ userId: string | null; username: string | null; avatarUrl: string | null; level: number | null }>({
    userId: null,
    username: null,
    avatarUrl: null,
    level: null,
  });

  const paint = useCallback(() => {
    const channel = channelRef.current;
    const state = channel?.presenceState?.() ?? {};
    const byViewer = new Map<string, Viewer>();
    Object.values(state).forEach((entries) => {
      if (!Array.isArray(entries)) return;
      (entries as unknown as Viewer[]).forEach((entry) => {
        if (!entry?.viewerId) return;
        const prev = byViewer.get(entry.viewerId);
        if (!prev || String(entry.trackedAt || "") >= String(prev.trackedAt || "")) {
          byViewer.set(entry.viewerId, entry);
        }
      });
    });
    if (!byViewer.size) {
      setRoster(emptyRoster());
      return;
    }
    const members: Roster["members"] = [];
    const guests: { viewerId: string; onlineAt: string }[] = [];
    const seen = new Set<string>();
    byViewer.forEach((entry) => {
      const username = String(entry.username || "").trim().slice(0, 20);
      const userId = String(entry.userId || "").trim().slice(0, 64);
      if (userId && username) {
        if (seen.has(userId)) return;
        seen.add(userId);
        members.push({ viewerId: entry.viewerId, userId, username, level: Math.max(1, Number(entry.level) || 1) });
      } else {
        guests.push({ viewerId: entry.viewerId, onlineAt: String(entry.onlineAt || "") });
      }
    });
    members.sort((a, b) => a.username.localeCompare(b.username));
    guests.sort((a, b) => a.onlineAt.localeCompare(b.onlineAt) || a.viewerId.localeCompare(b.viewerId));
    const guestRows = guests.map((g, i) => ({ ...g, guestLabel: `Guest${String(i + 1).padStart(3, "0")}` }));
    setRoster({ members, guests: guestRows, total: members.length + guestRows.length });
  }, []);

  const track = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    const p = profileRef.current;
    await channel.track({
      viewerId: getViewerId(),
      userId: p.userId,
      username: p.username,
      avatarUrl: p.avatarUrl,
      level: p.level,
      host: location.hostname,
      path: location.pathname,
      onlineAt: new Date().toISOString(),
      trackedAt: new Date().toISOString(),
    });
  }, []);

  const retrack = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      await channel.untrack();
      await track();
    } catch {
      // best-effort — presence just skips a beat
    }
  }, [track]);

  const loadProfile = useCallback(async () => {
    try {
      const session = await getSession();
      const userId = session?.user?.id ?? null;
      const username = (session?.user?.user_metadata?.username as string | undefined) ?? null;
      if (!userId || !username) {
        profileRef.current = { userId: null, username: null, avatarUrl: null, level: null };
        return;
      }
      const sb = getPublicClient();
      const { data } = await sb.from("troll_profiles").select("avatar_url, level").eq("id", userId).maybeSingle();
      profileRef.current = {
        userId,
        username,
        avatarUrl: data?.avatar_url ?? null,
        level: data?.level ?? 1,
      };
    } catch {
      profileRef.current = { userId: null, username: null, avatarUrl: null, level: null };
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadProfile();
      if (cancelled) return;
      const sb = getPublicClient();
      const channel = sb.channel(VIEWER_CHANNEL, { config: { presence: { key: getViewerId() } } });
      channelRef.current = channel;
      channel.on("presence", { event: "sync" }, paint).subscribe((status) => {
        if (status === "SUBSCRIBED") track();
      });
    })();
    const heartbeat = setInterval(retrack, 30000);
    const onAuthChanged = async () => {
      await loadProfile();
      retrack();
    };
    window.addEventListener("trollrunner:auth-changed", onAuthChanged);
    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      window.removeEventListener("trollrunner:auth-changed", onAuthChanged);
      channelRef.current?.unsubscribe();
    };
  }, [loadProfile, paint, track, retrack]);

  useEffect(() => {
    if (!open) return;
    function onClickAway(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickAway);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickAway);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const mine = getViewerId();
  const rows = [...roster.members, ...roster.guests];

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title={`${roster.total} ${roster.total === 1 ? "troll" : "trolls"} online`}
        className="nav-neon nav-neon--online whitespace-nowrap"
      >
        ● {roster.total} online
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-20 w-56 max-h-72 overflow-y-auto rounded-md border border-dim bg-black/90 backdrop-blur px-3 py-3 shadow-lg text-[11px] sm:text-xs">
          <p className="text-dim mb-2">
            {roster.total === 1 ? "Just you here right now." : `${roster.total} trolls online right now.`}
          </p>
          <div className="flex flex-col gap-1">
            {rows.map((who) => {
              const isMember = "username" in who;
              const label = isMember ? who.username : who.guestLabel;
              const isYou = who.viewerId === mine;
              return (
                <div key={who.viewerId} className="flex items-center gap-2 py-1">
                  <span className="text-foreground truncate flex-1 min-w-0">{label}</span>
                  {isMember && <span className="text-dim flex-none">LV {(who as { level: number }).level}</span>}
                  {isYou && <span className="text-problem flex-none">you</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
