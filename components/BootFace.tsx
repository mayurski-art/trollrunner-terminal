"use client";

import { useEffect, useRef } from "react";

// Total time for the dither grid to fully materialize once it starts.
export const FACE_REVEAL_MS = 1100;

const GRID = 78; // sample resolution (cells across/down the square canvas)
const CELL = 5; // px per cell at display size -> canvas is GRID*CELL square
const IMG_SRC = "/faces/base/trollface.png";

// Luminance below this reads as the trollface's black linework rather than
// its skin/teeth fill — the source art is a flat cartoon, so the two
// clusters sit far apart and a mid threshold separates them cleanly.
const INK_LUM = 110;

// Deterministic per-cell pseudo-random in [0,1) so the dithered edge and the
// per-dot flicker stay stable across frames instead of reshuffling.
function hash(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Renders trollface.png as a halftone grid of glyph dots. The grid fills the
// whole frame — background and skin/teeth alike — and only the art's black
// linework (outline, eyes, grin) punches holes in it, so the face reads as
// drawn rather than as a blank silhouette. Reveals cell-by-cell on a
// randomized schedule so it looks like the terminal rendering the image
// rather than a plain fade.
export default function BootFace({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let cancelled = false;
    let raf = 0;
    const img = new Image();
    img.src = IMG_SRC;
    img.onload = () => {
      if (cancelled) return;

      const src = document.createElement("canvas");
      src.width = img.width;
      src.height = img.height;
      const srcCtx = src.getContext("2d");
      if (!srcCtx) return;
      srcCtx.drawImage(img, 0, 0);
      const { data } = srcCtx.getImageData(0, 0, img.width, img.height);

      // Each cell takes the darkest opaque pixel in its source block rather
      // than a single sample: the outline strokes are only a few pixels wide,
      // and point-sampling drops them into broken dashes.
      const density = new Float32Array(GRID * GRID);
      const bw = img.width / GRID;
      const bh = img.height / GRID;
      for (let j = 0; j < GRID; j++) {
        for (let i = 0; i < GRID; i++) {
          let darkest = 255;
          let opaque = false;
          const x1 = Math.min(img.width, Math.ceil((i + 1) * bw));
          const y1 = Math.min(img.height, Math.ceil((j + 1) * bh));
          for (let y = Math.floor(j * bh); y < y1; y++) {
            for (let x = Math.floor(i * bw); x < x1; x++) {
              const idx = (y * img.width + x) * 4;
              if (data[idx + 3] < 128) continue;
              opaque = true;
              const lum =
                0.299 * data[idx] +
                0.587 * data[idx + 1] +
                0.114 * data[idx + 2];
              if (lum < darkest) darkest = lum;
            }
          }
          // Background and skin/teeth both fill; only the black linework
          // punches through, so the face reads as drawn rather than blank.
          density[j * GRID + i] = opaque && darkest < INK_LUM ? 0 : 1;
        }
      }

      canvas.width = GRID * CELL;
      canvas.height = GRID * CELL;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

      const revealAt: number[] = new Array(GRID * GRID)
        .fill(0)
        .map(() => Math.random());

      const start = performance.now();
      const draw = (progress: number) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f2f2f2";
        for (let j = 0; j < GRID; j++) {
          for (let i = 0; i < GRID; i++) {
            const k = j * GRID + i;
            const d = density[k];
            if (d < 0.03) continue;
            if (revealAt[k] > progress) continue;
            if (hash(i, j) > d) continue;

            ctx.globalAlpha = 0.75 + hash(i + 1, j + 1) * 0.25;
            ctx.fillRect(i * CELL + 1.5, j * CELL + 1.5, CELL - 3, CELL - 3);
          }
        }
        ctx.globalAlpha = 1;
      };

      if (reduceMotion) {
        draw(1);
        return;
      }

      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - start) / FACE_REVEAL_MS);
        draw(progress);
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: GRID * CELL, height: GRID * CELL }}
      aria-hidden="true"
    />
  );
}
