import sharp from "sharp";
import { statSync } from "node:fs";

const SRC = "./docs/trollface terminal grin.gif";
const scratch = "C:\\Users\\mayur\\AppData\\Local\\Temp\\claude\\c--Users-mayur-OneDrive-Documents-GitHub-mayurski-art-github-io\\e8f0922a-a211-4004-a0a3-17ba32d3847d\\scratchpad";

const meta = await sharp(SRC, { animated: true }).metadata();
const W = 480;
const H = Math.round((meta.pageHeight / meta.width) * W);
const STEP = 2;

const pages = [];
for (let p = 0; p < meta.pages; p += STEP) pages.push(p);

// Hard threshold to two tones: the site renders monochrome, so the art's
// green tint is dropped rather than quantised, which also removes the
// intermediate greys that were dominating the encoded size.
const frames = [];
for (const p of pages) {
  frames.push(
    await sharp(SRC, { page: p })
      .resize({ width: W, kernel: "nearest" })
      .grayscale()
      .threshold(70)
      .removeAlpha()
      .raw()
      .toBuffer()
  );
}

await sharp(Buffer.concat(frames), {
  raw: { width: W, height: H * frames.length, channels: 1, pageHeight: H },
})
  .gif({
    colours: 2,
    effort: 10,
    delay: Array(frames.length).fill(meta.delay[0] * STEP),
    loop: 0,
  })
  .toFile("./public/faces/trollface-grin.gif");

const size = statSync("./public/faces/trollface-grin.gif").size;
console.log(`frames ${frames.length}/${meta.pages}  ${W}x${H}  ${(size / 1024).toFixed(0)} KB`);

await sharp("./public/faces/trollface-grin.gif", { page: 10 })
  .png()
  .toFile(`${scratch}/check-final.png`);
