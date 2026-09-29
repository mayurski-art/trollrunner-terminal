"use client";

import { useEffect } from "react";

// The tab icon does the trolltruths hub's move (MiniConnector.tsx): a
// horizontal spin that swaps grin <-> sad while edge-on. Browsers only play
// animated GIF favicons in Firefox, so frames are drawn to a canvas and
// pushed into a <link rel="icon"> of our own (the last icon link wins).
// app/icon.png (the grin) stays the static icon wherever this doesn't run.
const FACE_GRIN = "/boot/trollface-grin.png";
const FACE_SAD = "/boot/trollface-sad.png";
const SIZE = 64;
const SPIN_MS = 400;
const FRAME_MS = 40;
const HOLD_MS = 1600; // gap between the start of one spin and the next

function load(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function AnimatedFavicon() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/png";

    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // squash = cos(spin angle): 1 is face-on, 0 is edge-on.
    const draw = (img: HTMLImageElement, squash: number) => {
      const scale = Math.min(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale * Math.max(squash, 0.04);
      const h = img.height * scale;
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      link.href = canvas.toDataURL("image/png");
    };

    Promise.all([load(FACE_GRIN), load(FACE_SAD)])
      .then(([grin, sad]) => {
        if (stopped) return;
        document.head.appendChild(link);
        let showingGrin = true;
        draw(grin, 1);

        const spin = (start: number) => {
          if (stopped) return;
          // Background tabs throttle timers to ~1/s, which would drag a spin
          // out over ten seconds — just swap faces there instead.
          if (document.hidden) {
            showingGrin = !showingGrin;
            draw(showingGrin ? grin : sad, 1);
            timer = setTimeout(() => spin(performance.now()), HOLD_MS);
            return;
          }
          const t = Math.min((performance.now() - start) / SPIN_MS, 1);
          const from = showingGrin ? grin : sad;
          const to = showingGrin ? sad : grin;
          draw(t < 0.5 ? from : to, Math.abs(Math.cos(t * Math.PI)));
          if (t < 1) {
            timer = setTimeout(() => spin(start), FRAME_MS);
          } else {
            showingGrin = !showingGrin;
            timer = setTimeout(() => spin(performance.now()), HOLD_MS - SPIN_MS);
          }
        };
        timer = setTimeout(() => spin(performance.now()), HOLD_MS);
      })
      .catch(() => {});

    return () => {
      stopped = true;
      clearTimeout(timer);
      link.remove();
    };
  }, []);

  return null;
}
