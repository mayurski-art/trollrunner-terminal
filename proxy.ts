import type { NextRequest } from "next/server";

// The terminal moved from terminal.trollrunner.net to trolltruths.com. Both
// hostnames point at this same Vercel deployment; a visitor landing on the
// old one gets a standalone "we moved" screen (not the app, no boot
// sequence) that forwards them to the same path on the new domain.
// /api is left alone by the matcher so the GitHub Actions crons keep working
// whichever hostname they call.
const OLD_HOST = "terminal.trollrunner.net";
const NEW_ORIGIN = "https://trolltruths.com";
const REDIRECT_SECONDS = 5;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (host !== OLD_HOST) return;

  const { pathname, search } = request.nextUrl;
  const target = new URL(pathname + search, NEW_ORIGIN).toString();
  const href = escapeHtml(target);
  const shown = escapeHtml(target.replace(/^https:\/\//, "").replace(/\/$/, ""));

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="${REDIRECT_SECONDS};url=${href}">
<link rel="canonical" href="${href}">
<meta name="robots" content="noindex">
<title>trollface terminal has moved</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    background: #000;
    color: #33ff66;
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .box {
    width: 100%;
    max-width: 560px;
    border: 1px solid #33ff66;
    padding: 28px 24px;
    box-shadow: 0 0 24px rgba(51, 255, 102, 0.15);
  }
  .dim { color: #1f9e40; font-size: 13px; }
  h1 { font-size: 18px; font-weight: 600; margin: 12px 0 20px; }
  p { font-size: 14px; line-height: 1.6; margin: 0 0 12px; }
  a { color: #eaffef; word-break: break-all; }
  .go {
    display: inline-block;
    margin-top: 12px;
    padding: 10px 16px;
    border: 1px solid #33ff66;
    color: #33ff66;
    text-decoration: none;
  }
  .go:hover, .go:focus-visible { background: #33ff66; color: #000; outline: none; }
  .cursor { animation: blink 1s steps(1) infinite; }
  @keyframes blink { 50% { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .cursor { animation: none; } }
</style>
</head>
<body>
  <main class="box">
    <div class="dim">&gt; ${escapeHtml(OLD_HOST)} // signal relocated</div>
    <h1>the terminal has moved<span class="cursor">_</span></h1>
    <p>same grin, new address:</p>
    <p><a href="${href}">${shown}</a></p>
    <p class="dim">rerouting in <span id="n">${REDIRECT_SECONDS}</span>s. update your bookmarks, troublemaker.</p>
    <a class="go" href="${href}">[ go now ]</a>
  </main>
  <script>
    (function () {
      var n = ${REDIRECT_SECONDS}, el = document.getElementById("n");
      var t = setInterval(function () {
        n -= 1;
        if (el) el.textContent = String(Math.max(n, 0));
        if (n <= 0) { clearInterval(t); location.replace(${JSON.stringify(target).replace(/</g, "\\u003c")}); }
      }, 1000);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!api/|_next/|assets/|favicon.ico).*)"],
};
