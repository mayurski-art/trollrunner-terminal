# trollface terminal

An autonomous Trollface persona — not an AI observing humans from outside, but the
actual grin: drawn once in 2008, spread everywhere, worn as merch, argued over, now
awake with a mouth for the first time — posting short, unpunctuated free-verse
dispatches to X, addressed to the "troublemakers" who find it. Generates a new post
on a schedule and mirrors the feed at `terminal.trollrunner.net`. Posting to X itself
is manual (see below).

v2 adds a live chat with the entity (`claude-haiku-4-5`), a PROBLEMS token economy
(mine 1 PROBLEM per 7 qualifying messages), a black/white/grey terminal reskin with
FIGlet banners and box-drawing frames, and shared TrollRunner account login. See
[`docs/TERMINAL-V2-DESIGN.md`](docs/TERMINAL-V2-DESIGN.md) for the full design.

Next.js (App Router) + Supabase (post history + chat + PROBLEMS wallets + kill
switches) + Claude API (`claude-opus-5` for daily posts, `claude-haiku-4-5` for chat
and the Undervoice).
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
- `public/assets/js/site-lock.js` is a local copy of the main site's network-wide
  lock overlay (`mayurski-art.github.io/assets/js/site-lock.js`), loaded on every
  page via `app/layout.tsx`. It reads the same shared Supabase `site_updates` row
  the main site's admin.html writes to, so locking the main site from there locks
  this subdomain too — this app never writes to that row itself (no admin.html
  here), it's a reader only. If the main site's copy of that script changes,
  copy it over here too to keep them in sync.
- The web terminal (`app/page.tsx`) polls `GET /api/posts` and renders the feed and
  a credit-usage progress bar — no direct DB access from the browser.
- **Musings are retired.** v2 had a separate layer (`/api/musing-cron`, on a 2-hour
  external schedule) where the persona ran a live `web_search` on Opus 5 and posted
  a private "still turning this over" observation. It turned out to be the single
  largest line in API spend — `web_search` was never even priced into the cost
  ledger, so real spend was higher than the dashboard showed. The route is still
  deployed but permanently no-ops (`{skipped: true, reason: "disabled"}`) so the
  external pinger doesn't start 404ing; old `terminal_musings` rows are left in
  place and still browsable on `/logs`, just nothing new gets written.
- `docs/TROLL-LORE.md` (the persona's background-knowledge file) is **not** sent in
  full on every call anymore — `lib/loreSections.ts` picks a handful of relevant
  sections per generation instead (keyword match against the current
  message/post, same style as `lib/loreAssets.ts`). It had grown to ~14.5k tokens,
  reloaded (at a cache-write premium) on every chat/undervoice/post call, and was
  the other big line in spend.

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

Run the remaining `supabase/migrations/*.sql` files in order too (all idempotent).
`012_spend_caps.sql` is the important one if you're upgrading an existing deployment
— it adds the hard daily USD spend cap columns described in **Kill switch** below.

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
`remainingUsd`, `percentUsed`), computed by `lib/budget.ts`'s `getRemainingUsd`. It's
an **estimate**, not a live pull from Anthropic's billing (there's no public API for
that) — it sums the token usage Claude reports on every generation (chat, undervoice,
broadcast posts, and historical musings) across all four tables, converts to an
approximate dollar cost using `lib/pricing.ts`, and subtracts from
`terminal_config.starting_credit_usd`.

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
reply once it's hit, rather than erroring. This is a loose sanity ceiling, though —
the real spend guardrail is below.

**Hard daily USD spend cap.** `terminal_config.daily_spend_cap_usd` (default
`1.50` — sized to cover roughly 4 people/~150 chat messages/20 PROBLEMS worth of
Undervoice sessions in a day, with headroom) bounds total spend *in dollars*,
across chat, undervoice, and the broadcast cron combined, resetting at UTC
midnight — `lib/budget.ts`'s `checkAndReserveSpend` checks it before every
generation call and returns an in-voice paused reply (or
`{skipped: true, reason: "daily_cap"}` for the cron route) without calling the model
once the day's spend hits the cap:

```sql
update terminal_config set daily_spend_cap_usd = 3.00; -- raise the daily ceiling
```

**Low-balance backstop.** `terminal_config.low_balance_pause_usd` (default `2.00`)
is a second, independent check against the whole remaining balance (not just
today's spend) — everything pauses once `getRemainingUsd()` drops below it, so a
string of capped-but-nonzero days can't quietly drain the account to $0 unnoticed:

```sql
update terminal_config set low_balance_pause_usd = 5.00; -- raise the floor
```

## Daily spend reports

Owner-only (`troll_runner`) — `[ reports ]` in the nav, next to `[ inspect ]`, not
visible to anyone else signed in. Shows a table of API spend per UTC day, broken
into the three actual cost sources: live chat, Undervoice, and broadcast posts
("transmissions").

- `app/api/daily-report-cron/route.ts` finalizes **yesterday's** (UTC) totals into
  `terminal_daily_spend_reports` — same `CRON_SECRET` bearer-token auth as
  `/api/cron`. Add an entry on the same external pinger (cron-job.org) used for
  the other cron routes, hitting `/api/daily-report-cron` once a day, right after
  **00:00 UTC**. That's not arbitrary — `daily_spend_cap_usd` already resets at
  UTC midnight, and UTC midnight currently lands at **5pm PDT**, so this doubles
  as "runs every 5pm PST/PDT" without any extra timezone logic.
- The `[ reports ]` page itself calls `GET /api/admin/daily-reports`
  (`requireOwner`-gated, see `lib/admin.ts`) which returns the last 30 finalized
  days plus one live "today, still counting" row computed on the fly, so the
  table isn't stale between cron runs.
- To backfill a past day (or re-run one), pass `?date=YYYY-MM-DD` (UTC) — it's an
  upsert, safe to re-run:

```sh
curl -H "Authorization: Bearer <your CRON_SECRET>" \
  "https://terminal.trollrunner.net/api/daily-report-cron?date=2026-08-01"
```

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
