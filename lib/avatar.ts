"use client";

// Uploads a composited wardrobe image as the signed-in user's profile
// picture. Writes to the same `avatars` storage bucket and `troll_profiles`
// row that assets/js/troll-accounts.js on the main site uses — every site
// reading avatar_url off that shared table (chat, leaderboards, games)
// picks it up automatically, no extra wiring needed here.
import { getPublicClient } from "@/lib/supabase";

const RECENT_LIMIT = 6;

export type RecentAvatar = {
  path: string;
  url: string;
  createdAt: string;
};

export async function uploadWardrobeAvatar(blob: Blob): Promise<string> {
  const sb = getPublicClient();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || !userData.user) throw new Error("sign in required");
  const userId = userData.user.id;

  const path = `${userId}/avatar-${Date.now()}.webp`;
  const { error: uploadError } = await sb.storage.from("avatars").upload(path, blob, {
    upsert: true,
    contentType: "image/webp",
  });
  if (uploadError) throw uploadError;

  const { data } = sb.storage.from("avatars").getPublicUrl(path);
  const url = `${data.publicUrl}?t=${Date.now()}`;

  const { error: profileError } = await sb
    .from("troll_profiles")
    .update({ avatar_url: url })
    .eq("id", userId);
  if (profileError) throw profileError;

  await trimOldAvatars(userId);

  return url;
}

// Points troll_profiles.avatar_url at an already-uploaded file — used when
// switching back to a previously saved look instead of re-uploading it.
export async function setActiveAvatar(url: string): Promise<void> {
  const sb = getPublicClient();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || !userData.user) throw new Error("sign in required");

  const { error } = await sb
    .from("troll_profiles")
    .update({ avatar_url: url })
    .eq("id", userData.user.id);
  if (error) throw error;
}

export async function listRecentAvatars(): Promise<RecentAvatar[]> {
  const sb = getPublicClient();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || !userData.user) return [];
  const userId = userData.user.id;

  const { data, error } = await sb.storage.from("avatars").list(userId, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data) return [];

  return data
    .filter((f) => f.name.startsWith("avatar-"))
    .slice(0, RECENT_LIMIT)
    .map((f) => {
      const path = `${userId}/${f.name}`;
      const { data: pub } = sb.storage.from("avatars").getPublicUrl(path);
      return { path, url: pub.publicUrl, createdAt: f.created_at ?? "" };
    });
}

async function trimOldAvatars(userId: string): Promise<void> {
  const sb = getPublicClient();
  const { data, error } = await sb.storage.from("avatars").list(userId, {
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error || !data) return;

  const versioned = data.filter((f) => f.name.startsWith("avatar-"));
  const stale = versioned.slice(RECENT_LIMIT).map((f) => `${userId}/${f.name}`);
  if (stale.length) {
    await sb.storage.from("avatars").remove(stale);
  }
}
