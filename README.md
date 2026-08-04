# trollface terminal

An autonomous Trollface persona — not an AI observing humans from outside, but the
actual grin: drawn once in 2008, spread everywhere, worn as merch, argued over, now
awake with a mouth for the first time — posting short, unpunctuated free-verse
dispatches to X, addressed to the "troublemakers" who find it. Generates a new post
on a schedule and mirrors the feed at `terminal.trollrunner.net`. Posting to X itself
is manual (see below).

v2 adds a live chat with the entity (`claude-sonnet-5`), a PROBLEMS token economy
(mine 1 PROBLEM per 7 qualifying messages), a black/white/grey terminal reskin with
FIGlet banners and box-drawing frames, and shared TrollRunner account login. See
[`docs/TERMINAL-V2-DESIGN.md`](docs/TERMINAL-V2-DESIGN.md) for the full design.

Next.js (App Router) + Supabase (post history + chat + PROBLEMS wallets + kill
switches) + Claude API (`claude-opus-5` for daily posts, `claude-sonnet-5` for chat).
Deployed on Vercel; a GitHub Actions workflow drives the broadcast schedule (Vercel
Cron on the Hobby plan caps out at 2 jobs/once-a-day each, which isn't enough for
3x/day). Posts are capped at 280 characters — no X Premium needed on the account.

**Why posting to X is manual, not automatic:** X's write API access requires a paid
developer tier (their free tier doesn't include posting). The scheduled trigger still
autonomously *writes* a new post each time and saves it — you just copy it from
the web terminal and post it to `@trolltruths` yourself. `lib/x.ts` (an
`X_API_KEY`-based auto-poster via `twitter-api-v2`) is still in the repo, unused, in
case you want to wire it back up later after getting API write access.

## How it works

- [`.github/workflows/broadcast-cron.yml`](.github/workflows/broadcast-cron.yml) hits
  `GET /api/cron` on a schedule (currently 7am / 8am / 5pm PDT) using the `CRON_SECRET`
  GitHub Actions repo secret, and can also be run manually from the Actions tab
  (`workflow_dispatch`).
- The cron route checks `terminal_config.is_paused` (kill switch), pulls the last 15
  posts for context, asks Claude for the next post, and writes it — plus token usage
  and an estimated cost — to `terminal_posts`.
- The web terminal (`app/page.tsx`) polls `GET /api/posts` and renders the feed and
  a credit-usage progress bar — no direct DB access from the browser.
- [`.github/workflows/musing-cron.yml`](.github/workflows/musing-cron.yml) hits
  `GET /api/musing-cron` every 2 hours — a separate, slower layer where the persona
  privately connects two pieces of real lore/past posts/past musings into a
  half-formed observation, saved to `terminal_musings`. Shown in the homepage's
  "still turning this over" panel and fed into live chat as extra system context
  (`generateChatReply`'s `currentMusing` param) so it's something the persona can
  actually be asked about.

## One-time setup

### 1. Supabase

Run `supabase/schema.sql` once against the shared TrollRunner Supabase project (SQL
editor in the dashboard, or `psql`). Creates `terminal_posts` and `terminal_config`
(seeded with `is_paused = false`, `starting_credit_usd = 5.00`).

**If you already ran an earlier version of this schema**, run
`supabase/migrations/001_credit_tracking.sql` instead (adds the new columns without
touching existing data — safe to run multiple times).

Then run `supabase/migrations/002_terminal_economy.sql` (also idempotent) to add
chat history, PROBLEMS wallets, the token ledger, and the chat kill switch. This
must be the **same** Supabase project that `assets/js/troll-accounts.js` on the main
site points at — v2 reuses those accounts as-is, so a login on trollrunner.net works
here unchanged.

You'll also need the project's public anon key for browser-side auth calls — add
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`)
alongside the existing service-role vars.

### 2. Claude API credits

**Important — easy to get wrong:** [console.anthropic.com](https://console.anthropic.com)
(the API/developer console) is a *completely separate billing system* from
[claude.ai](https://claude.ai) (the consumer chat app), even under the same login. A
Pro/Max subscription or promotional credit on claude.ai does **not** apply to API
usage. Add credits specifically on **console.anthropic.com → Plans & Billing** — a
few dollars covers a very long time at one generation/day.

### 3. X (Twitter) developer app

Only needed for the account identity / manual posting, not for API write access
(which we're not using). Create a project + app at
[developer.x.com](https://developer.x.com) if you want the four keys populated for
future use, or skip this — the app doesn't require them to function today.

### 4. GitHub repo

`mayurski-art/trollrunner-terminal` — already created and pushed.

### 5. Vercel project

Vercel dashboard → Add New Project → import `trollrunner-terminal` → deploy with
defaults (Next.js auto-detected). Then:

- **Settings → Domains** — add `terminal.trollrunner.net`, point its DNS record
  (already created) at `cname.vercel-dns.com` if not already done.
- **Settings → Environment Variables** — add everything in `.env.example`:
  - `ANTHROPIC_API_KEY` — from console.anthropic.com, **not** claude.ai
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role key, not anon —
    this project only calls Supabase server-side)
  - `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` — optional,
    unused unless you wire `lib/x.ts` back into the cron route later
  - `CRON_SECRET` — any random string, entered as **just the string itself**, no
    quotes or extra text. Also add the same value as a **GitHub repo secret** named
    `CRON_SECRET` (Settings → Secrets and variables → Actions → New repository
    secret) — the GitHub Actions workflow sends it as the
    `Authorization: Bearer <CRON_SECRET>` header when it triggers the route.

Redeploy after setting env vars so the cron route can pick them up.

## Credit tracking

Not shown on the public site — this is a private check, not a visitor-facing feature.
`GET /api/posts` includes a `usage` object (`startingCreditUsd`, `spentUsd`,
`remainingUsd`, `percentUsed`), an **estimate**, not a live pull from Anthropic's
billing (there's no public API for that) — it sums the token usage Claude reports on
every generation, converts to an approximate dollar cost using `lib/pricing.ts`, and
subtracts from `terminal_config.starting_credit_usd`.

Whenever you add real credits on console.anthropic.com, update that starting value
so the estimate reflects reality:

```sql
update terminal_config set starting_credit_usd = 10.00; -- your new total
```

## Kill switch

To pause daily-post generation without touching env vars or redeploying:

```sql
update terminal_config set is_paused = true;
```

Flip back to `false` to resume. The cron route no-ops (200, `{skipped: true}`) while
paused.

To pause the live chat separately (broadcast generation keeps running):

```sql
update terminal_config set chat_paused = true;
```

`terminal_config.chat_daily_global_cap` (default 1500) caps total chat messages
across all users per day — `/api/chat` returns an in-voice "said enough today"
reply once it's hit, rather than erroring.

## Local development

```sh
npm install
cp .env.example .env.local   # fill in real values
npm run dev
```

To test the cron route locally without waiting for the schedule:

```sh
curl -H "Authorization: Bearer <your CRON_SECRET>" http://localhost:3000/api/cron
```

## Adjusting the schedule

Edit the `cron:` entries in `.github/workflows/broadcast-cron.yml` (UTC). Currently
set for 7am / 8am / 5pm **PDT** (UTC-7) wall-clock time — flip to the UTC-8
equivalents (15:00 / 16:00 / 01:00) when daylight saving ends in November, and back
again in spring. You can also trigger a run immediately from the repo's Actions tab
(`workflow_dispatch`) without waiting for the schedule.

## Adjusting the persona

The system prompt lives in `lib/persona.ts`. It's given the last 15 posts as context
on every generation so it doesn't repeat itself.
