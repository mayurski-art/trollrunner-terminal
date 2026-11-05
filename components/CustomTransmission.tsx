"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicClient } from "@/lib/supabase";
import { displayName } from "@/lib/auth";
import { OWNER_USERNAME } from "@/lib/ownerUsername";
import type { Post } from "@/app/riddles/page";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function CustomTransmission({
  session,
  onCreated,
}: {
  session: Session | null;
  onCreated: (post: Post) => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [kind, setKind] = useState<"clue" | "musing">("musing");
  const [answer, setAnswer] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isOwner = displayName(session) === OWNER_USERNAME;

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (!isOwner) return null;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const sb = getPublicClient();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      const form = new FormData();
      form.set("content", content);
      form.set("kind", kind);
      form.set("answer", answer);
      if (image) form.set("image", image);
      const response = await fetch("/api/admin/custom-transmission", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "could not publish transmission");
        return;
      }
      onCreated(result.post as Post);
      setContent("");
      setKind("musing");
      setAnswer("");
      setImage(null);
      setOpen(false);
    } catch {
      setError("connection to the terminal was lost");
    } finally {
      setBusy(false);
    }
  }

  function selectImage(file: File | undefined) {
    setError(null);
    if (!file) {
      setImage(null);
    } else if (!ACCEPTED_TYPES.includes(file.type)) {
      setImage(null);
      setError("use a JPEG, PNG, WebP, or GIF image");
    } else if (file.size > MAX_IMAGE_BYTES) {
      setImage(null);
      setError("image must be 5 MB or smaller");
    } else {
      setImage(file);
    }
  }

  return (
    <section className="mb-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="text-xs border px-2 py-1 hover:bg-[#b26bff] hover:text-background transition-colors"
        style={{ color: "#b26bff", borderColor: "#b26bff" }}
      >
        [ {open ? "cancel custom transmission" : "write custom transmission"} ]
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 border border-[#b26bff]/40 p-3 space-y-3">
          <p className="text-ghost text-xs">[ written here, published directly — no generator ]</p>
          <label className="block text-xs text-ghost" htmlFor="custom-transmission-content">
            transmission
            <textarea
              id="custom-transmission-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={5000}
              rows={5}
              required
              placeholder="write your transmission..."
              className="mt-1 block w-full resize-y bg-transparent border border-dim px-2 py-1.5 text-sm text-you outline-none focus:border-[#b26bff]"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ghost w-fit cursor-pointer">
            <input
              type="checkbox"
              checked={kind === "clue"}
              onChange={(event) => setKind(event.target.checked ? "clue" : "musing")}
              className="accent-problem"
            />
            mark as a clue transmission
          </label>
          {kind === "clue" && (
            <label className="block text-xs text-ghost" htmlFor="custom-transmission-answer">
              hidden answer (optional; separate accepted answers with |)
              <input
                id="custom-transmission-answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                maxLength={100}
                placeholder="answer or answer|alternate"
                className="mt-1 block w-full bg-transparent border border-dim px-2 py-1.5 text-xs text-you outline-none focus:border-[#b26bff]"
              />
            </label>
          )}
          <div>
            <label htmlFor="custom-transmission-image" className="block text-xs text-ghost">
              attach image (JPEG, PNG, WebP, GIF · max 5 MB)
            </label>
            <input
              id="custom-transmission-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => selectImage(event.target.files?.[0])}
              className="mt-1 block w-full text-xs text-dim file:mr-3 file:border file:border-dim file:bg-transparent file:px-2 file:py-1 file:text-xs file:text-terminal"
            />
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected transmission preview" className="mt-2 max-h-56 max-w-full rounded border border-dim object-contain" />
            )}
          </div>
          {error && <p role="alert" className="text-alert text-xs">[ {error} ]</p>}
          <button
            type="submit"
            disabled={busy || !content.trim()}
            className="text-xs text-terminal border border-terminal px-2 py-1 hover:bg-terminal hover:text-background transition-colors disabled:opacity-40"
          >
            {busy ? "publishing..." : "✓ publish transmission"}
          </button>
        </form>
      )}
    </section>
  );
}
