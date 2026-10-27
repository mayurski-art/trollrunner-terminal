// Renders the node system as two GIFs: the boot reveal and the header loop.
//
//   node tools/node-system-gif.mjs [url]
//
// url defaults to http://localhost:3010; if nothing answers there, this
// starts `next dev` on 3010 itself and stops it when done. Output goes to
// screenshots/node-system/ as node-system-{boot,header}-YYYY-MM-DD-HHMM.gif,
// so earlier renders are never overwritten. Needs ffmpeg on PATH.
//
// Frame-exact at 25fps, 2x: Playwright's clock drives the page's timers,
// and every CSS animation plus the hub <video> is pinned to that same
// virtual time before each screenshot, so slow 2x screenshots still come
// out smooth and correctly timed.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const TARGET = process.argv[2] || "http://localhost:3010";
const STEP = 40; // ms per frame (25fps)
const VP = { width: 1440, height: 900 };
const PAD = 16;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "screenshots", "node-system");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "node-system-"));

async function up(url) {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

let dev = null;
if (!(await up(TARGET))) {
  if (!TARGET.startsWith("http://localhost:3010")) throw new Error(`${TARGET} isn't answering`);
  console.log("starting next dev on 3010...");
  dev = spawn(process.execPath, [path.join(ROOT, "node_modules/next/dist/bin/next"), "dev", "-p", "3010"], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 120 && !(await up(TARGET)); i++) await new Promise((r) => setTimeout(r, 1000));
  if (!(await up(TARGET))) throw new Error("next dev didn't come up");
}

const browser = await chromium.launch();
try {
  const warm = await browser.newPage();
  await warm.goto(TARGET, { waitUntil: "networkidle" }).catch(() => {});
  await warm.close();

  async function open() {
    const page = await browser.newPage({ viewport: VP, deviceScaleFactor: 2 });
    await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
    await page.goto(TARGET, { waitUntil: "load" });
    await page.mouse.move(VP.width - 2, VP.height - 2);
    // the site's custom cursor follows the real pointer; keep it out of frame
    await page.addStyleTag({ content: "[class*=cursor-dot],[class*=cursor-ring]{display:none!important}" });
    let vt = 0;
    const step = async (ms) => {
      await page.clock.runFor(ms);
      vt += ms;
      await page.evaluate((vt) => {
        for (const a of document.getAnimations()) {
          if (a.__v0 === undefined) {
            a.__v0 = vt - (a.currentTime || 0);
            a.pause();
          }
          a.currentTime = vt - a.__v0;
        }
        for (const v of document.querySelectorAll("video")) {
          v.pause();
          if (v.duration) v.currentTime = (vt / 1000) % v.duration;
        }
      }, vt);
    };
    return { page, step, now: () => vt };
  }

  const ring1 = ".boot-connector .bc-node--umadbro.bc-revealed";
  // pass 1: when does ring 1 land, in virtual time?
  let { page, step, now } = await open();
  for (let i = 0; i < 500 && !(await page.locator(ring1).count()); i++) await step(STEP);
  const ring1At = now();
  await page.close();

  // pass 2: replay to the hub's solo beat, capture the reveal
  ({ page, step, now } = await open());
  while (now() + 100 <= ring1At - 700) await step(100);
  while (now() < ring1At - 700) await step(STEP);
  const bb = await page.locator(".boot-connector").boundingBox();
  const bootClip = { x: bb.x - PAD, y: bb.y - PAD, width: bb.width + PAD * 2, height: bb.height + PAD * 2 };
  fs.mkdirSync(path.join(TMP, "boot"));
  fs.mkdirSync(path.join(TMP, "header"));
  // stop just before the overlay starts fading to the site
  let n = 0;
  for (; n < 200; n++) {
    const fading = await page.evaluate(() => {
      const el = document.querySelector(".boot-connector");
      if (!el) return true;
      let o = 1;
      for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
      return o < 0.98;
    });
    if (fading) break;
    await page.screenshot({ path: path.join(TMP, "boot", `${String(n).padStart(4, "0")}.png`), clip: bootClip });
    await step(STEP);
  }
  const bootFrames = n;

  // the header widget, two full 3.2s packet cycles
  for (let i = 0; i < 100 && (await page.locator(".boot-connector").count()); i++) await step(100);
  await step(1000);
  const mb = await page.locator(".mini-connector").first().boundingBox();
  const headerClip = { x: mb.x - PAD, y: mb.y - PAD, width: mb.width + PAD * 2, height: mb.height + PAD + 2 };
  const headerFrames = Math.round(6400 / STEP);
  for (let i = 0; i < headerFrames; i++) {
    await page.screenshot({ path: path.join(TMP, "header", `${String(i).padStart(4, "0")}.png`), clip: headerClip });
    await step(STEP);
  }
  await page.close();

  fs.mkdirSync(OUT, { recursive: true });
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  const gif = (dir, frames, width, extra, name) => {
    const file = path.join(OUT, `node-system-${name}-${stamp}.gif`);
    const r = spawnSync("ffmpeg", [
      "-loglevel", "error", "-y", "-framerate", "25", "-start_number", "0",
      "-i", path.join(TMP, dir, "%04d.png"), "-frames:v", String(frames),
      "-filter_complex", `[0]scale=${width}:-1:flags=lanczos${extra},split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`,
      file,
    ], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`ffmpeg failed on ${name}`);
    console.log(`${file}  ${(fs.statSync(file).size / 1e6).toFixed(1)} MB`);
  };
  // the reveal holds on the finished tree for 1.6s before it loops
  gif("boot", bootFrames, 1400, ",tpad=stop_mode=clone:stop_duration=1.6", "boot");
  gif("header", headerFrames, 994, "", "header");
} finally {
  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  if (dev) dev.kill();
}
