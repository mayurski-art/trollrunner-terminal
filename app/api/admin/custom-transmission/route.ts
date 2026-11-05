import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireOwner } from "@/lib/admin";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Owner-only, direct publishing path for transmissions written by hand.
// This deliberately does not call any text-generation provider.
export async function POST(request: Request) {
  const owner = await requireOwner(request);
  if (!owner) {
    return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const content = String(form.get("content") ?? "").trim();
  if (!content) {
    return NextResponse.json({ error: "write the transmission first" }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "transmission must be 5,000 characters or fewer" }, { status: 400 });
  }

  const rawKind = String(form.get("kind") ?? "musing");
  const kind = rawKind === "clue" ? "clue" : "musing";
  const clueTag = String(form.get("answer") ?? "").trim().slice(0, 100) || null;
  const candidate = form.get("image");
  const image = candidate instanceof File && candidate.size > 0 ? candidate : null;

  if (image && !IMAGE_TYPES[image.type]) {
    return NextResponse.json({ error: "use a JPEG, PNG, WebP, or GIF image" }, { status: 400 });
  }
  if (image && image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image must be 5 MB or smaller" }, { status: 400 });
  }

  const { supabase } = owner;
  let artUrl: string | null = null;
  let imagePath: string | null = null;
  if (image) {
    imagePath = `${randomUUID()}.${IMAGE_TYPES[image.type]}`;
    const { error: uploadError } = await supabase.storage
      .from("transmission-art")
      .upload(imagePath, image, { contentType: image.type, upsert: false });
    if (uploadError) {
      return NextResponse.json({ error: `image upload failed: ${uploadError.message}` }, { status: 500 });
    }
    artUrl = supabase.storage.from("transmission-art").getPublicUrl(imagePath).data.publicUrl;
  }

  const { data: post, error } = await supabase
    .from("terminal_posts")
    .insert({
      content,
      kind,
      clue_tag: clueTag,
      art_url: artUrl,
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
      estimated_cost_usd: 0,
      pending: false,
    })
    .select("id, content, kind, x_post_url, art_url, posted_at")
    .single();

  if (error || !post) {
    if (imagePath) {
      const { error: cleanupError } = await supabase.storage.from("transmission-art").remove([imagePath]);
      if (cleanupError) console.error("[custom-transmission] image cleanup failed:", cleanupError.message);
    }
    return NextResponse.json({ error: error?.message ?? "could not save transmission" }, { status: 500 });
  }

  return NextResponse.json({ post }, { status: 201 });
}
