// One-off generator: run with `node scripts/gen-banners.mjs` to print FIGlet
// banners for pasting into lib/ascii.ts. Not part of the runtime build.
import figlet from "figlet";

const words = [
  "TROLLFACE",
  "TERMINAL",
  "THE VAULT",
  "THE LOGS",
  "SIGNAL LOST",
  "PROBLEMS",
];

for (const w of words) {
  console.log(`\n=== ${w} ===`);
  console.log(figlet.textSync(w, { font: "ANSI Shadow" }));
}
