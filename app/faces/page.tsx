"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSession, onAuthChange } from "@/lib/auth";
import { uploadWardrobeAvatar } from "@/lib/avatar";
import Nav from "@/components/Nav";
import Banner from "@/components/Banner";
import Frame from "@/components/Frame";
import WardrobeCanvas, { type WardrobeCanvasHandle } from "@/components/WardrobeCanvas";
import { BANNER_FACES } from "@/lib/ascii";
import { SLOTS, WARDROBE_ITEMS, type WardrobeSlot } from "@/lib/wardrobe";

export default function FacesPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [equipped, setEquipped] = useState<Partial<Record<WardrobeSlot, string>>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<WardrobeCanvasHandle>(null);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoaded(true);
    });
    return onAuthChange(setSession);
  }, []);

  function toggleItem(slot: WardrobeSlot, itemId: string) {
    setEquipped((prev) => ({ ...prev, [slot]: prev[slot] === itemId ? undefined : itemId }));
  }

  async function saveAsAvatar() {
    if (!canvasRef.current) return;
    setSaving(true);
    setStatus(null);
    try {
      const blob = await canvasRef.current.exportBlob();
      await uploadWardrobeAvatar(blob);
      setStatus("saved — your new profile picture is live across the network");
    } catch (err) {
      setStatus((err as Error).message || "could not save avatar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-2xl">
        <Nav />
        <Banner art={BANNER_FACES} label="the wardrobe" />
        <p className="text-dim text-sm mb-8">
          dress the grin. save it as your profile picture across the whole network.
        </p>

        {!loaded && <p className="text-dim text-sm animate-pulse">loading wardrobe...</p>}

        {loaded && !session && (
          <Frame tone="dim">
            <p className="text-dim text-sm">sign in to build and save a face.</p>
          </Frame>
        )}

        {loaded && session && (
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center gap-3">
              <WardrobeCanvas ref={canvasRef} equipped={equipped} />
              <button
                onClick={saveAsAvatar}
                disabled={saving}
                className="border border-terminal text-terminal px-4 py-1.5 text-sm hover:bg-terminal hover:text-background transition-colors disabled:opacity-40 w-full"
              >
                {saving ? "saving..." : "save as profile picture"}
              </button>
              {status && <p className="text-dim text-xs text-center">{status}</p>}
            </div>

            <div className="flex-1 space-y-5">
              {SLOTS.map((slot) => {
                const items = WARDROBE_ITEMS.filter((i) => i.slot === slot.id);
                if (items.length === 0) return null;
                return (
                  <Frame key={slot.id} title={slot.label} tone="dim">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setEquipped((prev) => ({ ...prev, [slot.id]: undefined }))}
                        className={`border px-3 py-1 text-xs ${
                          !equipped[slot.id]
                            ? "border-terminal text-terminal"
                            : "border-dim text-dim hover:text-terminal"
                        }`}
                      >
                        none
                      </button>
                      {items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => toggleItem(slot.id, item.id)}
                          className={`border px-3 py-1 text-xs ${
                            equipped[slot.id] === item.id
                              ? "border-terminal text-terminal"
                              : "border-dim text-dim hover:text-terminal"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </Frame>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
