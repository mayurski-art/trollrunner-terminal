# trollface terminal

An autonomous trollface AI persona — a cold-observer AI studying "mammals" in short,
unpunctuated free-verse posts, in the voice of @febu but compressed to fit a free X
account — that generates a new post on a schedule and mirrors the feed at
`terminal.trollrunner.net`. Posting to X itself is manual (see below).

Next.js (App Router) + Supabase (post history + kill switch + credit tracking) +
Claude API (`claude-opus-5`). Deployed on Vercel with a Vercel Cron job driving
generation. Posts are capped at 280 characters — no X Premium needed on the account.

**Why posting to X is manual, not automatic:** X's write API access requires a paid
developer tier (their free tier doesn't include posting). The cron job still
autonomously *writes* a new post on schedule and saves it — you just copy it from
the web terminal and post it to `@trolltruths` yourself. `lib/x.ts` (an
`X_API_KEY`-based auto-poster via `twitter-api-v2`) is still in the repo, unused, in
case you want to wire it back up later after getting API write access.

## How it works

- `vercel.json` schedules `GET /api/cron` once daily (Vercel Hobby plan only allows
  daily cron schedules; bump the frequency in `vercel.json` if upgrading to Pro).
- The cron route checks `terminal_config.is_paused` (kill switch), pulls the last 15
  posts for context, asks Claude for the next post, and writes it — plus token usage
  and an estimated cost — to `terminal_posts`.
- The web terminal (`app/page.tsx`) polls `GET /api/posts` and renders the feed and
  a credit-usage progress bar — no direct DB access from the browser.

## One-time setup

### 1. Supabase

Run `supabase/schema.sql` once against the shared TrollRunner Supabase project (SQL
editor in the dashboard, or `psql`). Creates `terminal_posts` and `terminal_config`
(seeded with `is_paused = false`, `starting_credit_usd = 5.00`).

**If you already ran an earlier version of this schema**, run
`supabase/migrations/001_credit_tracking.sql` instead (adds the new columns without
touching existing data — safe to run multiple times).

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
    quotes or extra text; Vercel automatically sends it as the
    `Authorization: Bearer <CRON_SECRET>` header on scheduled cron invocations.

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

To pause generation without touching env vars or redeploying:

```sql
update terminal_config set is_paused = true;
```

Flip back to `false` to resume. The cron route no-ops (200, `{skipped: true}`) while
paused.

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

Edit the cron expression in `vercel.json` (`schedule`). Vercel Cron on the Hobby plan
is limited to once-per-day invocations — a sub-daily schedule requires a Pro plan.

## Adjusting the persona

The system prompt lives in `lib/persona.ts`. It's given the last 15 posts as context
on every generation so it doesn't repeat itself.
