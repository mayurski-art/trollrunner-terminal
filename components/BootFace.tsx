"use client";

import { useEffect, useRef } from "react";

// Total time for the dither grid to fully materialize once it starts.
export const FACE_REVEAL_MS = 1100;

const GRID = 48; // sample resolution (cells across/down the square canvas)
const CELL = 7; // px per cell at display size -> canvas is GRID*CELL square
const IMG_SRC = "/faces/base/trollface.png";

// Deterministic per-cell pseudo-random in [0,1) so the dithered edge and the
// per-dot flicker stay stable across frames instead of reshuffling.
function hash(i: number, j: number): number {
  const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Renders trollface.png as a halftone grid of glyph dots: dense where the
// source PNG is transparent (background), empty where it's opaque (the face
// itself becomes a silhouette hole), feathered at the edge by the browser's
// own downscale smoothing. Reveals cell-by-cell on a randomized schedule so
// it reads as the terminal rendering the image rather than a plain fade.
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

      const sample = document.createElement("canvas");
      sample.width = GRID;
      sample.height = GRID;
      const sctx = sample.getContext("2d");
      if (!sctx) return;
      sctx.drawImage(img, 0, 0, GRID, GRID);
      const { data } = sctx.getImageData(0, 0, GRID, GRID);

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
            const idx = (j * GRID + i) * 4;
            const density = 1 - data[idx + 3] / 255; // dense outside the face
            if (density < 0.03) continue;
            if (revealAt[j * GRID + i] > progress) continue;
            if (hash(i, j) > density) continue;

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
