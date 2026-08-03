"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { BASE_FACE_SRC, CANVAS_SIZE, WARDROBE_ITEMS, type WardrobeSlot } from "@/lib/wardrobe";

export type WardrobeCanvasHandle = {
  exportBlob: () => Promise<Blob>;
};

type WardrobeCanvasProps = {
  equipped: Partial<Record<WardrobeSlot, string>>;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

// Draw order matters: base face first, then equipped items — headwear/mouth/
// neck items are drawn after the face by definition order in WARDROBE_ITEMS,
// which already places eyewear above the face and below nothing else since
// there's only one layer per slot at a time.
const SLOT_DRAW_ORDER: WardrobeSlot[] = ["neck", "mouth", "eyewear", "headwear"];

const WardrobeCanvas = forwardRef<WardrobeCanvasHandle, WardrobeCanvasProps>(function WardrobeCanvas(
  { equipped },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const base = await loadImage(BASE_FACE_SRC);
    ctx.drawImage(base, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    for (const slot of SLOT_DRAW_ORDER) {
      const itemId = equipped[slot];
      if (!itemId) continue;
      const item = WARDROBE_ITEMS.find((i) => i.id === itemId);
      if (!item) continue;
      try {
        const img = await loadImage(item.src);
        ctx.drawImage(img, item.x, item.y, img.width * item.scale, img.height * item.scale);
      } catch {
        // Missing item art shouldn't blank the whole composite.
      }
    }
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipped]);

  useImperativeHandle(ref, () => ({
    exportBlob: () =>
      new Promise<Blob>((resolve, reject) => {
        const canvas = canvasRef.current;
        if (!canvas) return reject(new Error("canvas not ready"));
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("export failed"))), "image/webp", 0.92);
      }),
  }));

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      className="w-full max-w-xs aspect-square border border-dim bg-panel"
      style={{ imageRendering: "pixelated" }}
    />
  );
});

export default WardrobeCanvas;
