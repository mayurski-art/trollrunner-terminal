// Turns an old trollrunner-stickers animation into a transparent GIF.
// Usage: node scripts/transparent-sticker-gif.mjs <src.gif> <out.gif> [width]
//
// Only the white backdrop connected to the frame edge is knocked out (a
// flood fill per frame), so white areas enclosed by line art — the
// trollface itself, the monitor bezel — stay opaque.
import sharp from "sharp";
import { statSync } from "node:fs";

const [SRC, OUT, widthArg] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error("usage: node scripts/transparent-sticker-gif.mjs <src.gif> <out.gif> [width]");
  process.exit(1);
}

// Anything at least this bright counts as backdrop when it touches the edge.
const WHITE = 215;

const meta = await sharp(SRC, { animated: true }).metadata();
const W = Number(widthArg) || meta.width;
const H = Math.round((meta.pageHeight / meta.width) * W);

const frames = [];
for (let p = 0; p < meta.pages; p++) {
  const rgba = await sharp(SRC, { page: p })
    .resize({ width: W })
    .ensureAlpha()
    .raw()
    .toBuffer();

  const isWhite = (i) =>
    rgba[i * 4] >= WHITE && rgba[i * 4 + 1] >= WHITE && rgba[i * 4 + 2] >= WHITE;

  const seen = new Uint8Array(W * H);
  const stack = [];
  const push = (i) => {
    if (!seen[i] && isWhite(i)) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    rgba[i * 4 + 3] = 0;
    const x = i % W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W);
    if (i < W * (H - 1)) push(i + W);
  }
  frames.push(rgba);
}

await sharp(Buffer.concat(frames), {
  raw: { width: W, height: H * frames.length, channels: 4, pageHeight: H },
})
  .gif({ colours: 16, dither: 0, effort: 10, interFrameMaxError: 8, delay: meta.delay, loop: 0 })
  .toFile(OUT);

console.log(`${OUT}: ${W}x${H}, ${frames.length} frames, ${statSync(OUT).size} bytes`);
