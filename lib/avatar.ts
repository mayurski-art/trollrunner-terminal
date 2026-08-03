"use client";

// Uploads a composited wardrobe image as the signed-in user's profile
// picture. Writes to the same `avatars` storage bucket and `troll_profiles`
// row that assets/js/troll-accounts.js on the main site uses — every site
// reading avatar_url off that shared table (chat, leaderboards, games)
// picks it up automatically, no extra wiring needed here.
import { getPublicClient } from "@/lib/supabase";

export async function uploadWardrobeAvatar(blob: Blob): Promise<string> {
  const sb = getPublicClient();
  const { data: userData, error: userError } = await sb.auth.getUser();
  if (userError || !userData.user) throw new Error("sign in required");
  const userId = userData.user.id;

  const path = `${userId}/avatar.webp`;
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

  return url;
}
