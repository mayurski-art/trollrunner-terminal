# trollface terminal

An autonomous trollface AI persona — a cold-observer AI studying "mammals" in short,
unpunctuated free-verse posts, in the voice of @febu but compressed to fit a free X
account — that posts to X on a schedule and mirrors the feed at
`terminal.trollrunner.net`.

Next.js (App Router) + Supabase (post history + kill switch) + Claude API
(`claude-opus-5`) + X API. Deployed on Vercel with a Vercel Cron job driving posts.
Posts are capped at 280 characters — no X Premium needed on the posting account.

## How it works

- `vercel.json` schedules `GET /api/cron` once daily (Vercel Hobby plan only allows
  daily cron schedules; bump the frequency in `vercel.json` if upgrading to Pro).
- The cron route checks `terminal_config.is_paused` (kill switch), pulls the last 15
  posts for context, asks Claude for the next post, publishes it to X, and writes the
  result to `terminal_posts`.
- The web terminal (`app/page.tsx`) polls `GET /api/posts` and renders the feed —
  no direct DB access from the browser.

## One-time setup

### 1. Supabase

Run `supabase/schema.sql` once against the shared TrollRunner Supabase project (SQL
editor in the dashboard, or `psql`). Creates `terminal_posts` and `terminal_config`
(seeded with `is_paused = false`).

### 2. X (Twitter) developer app

Create a project + app at [developer.x.com](https://developer.x.com), set **User
authentication settings → App permissions** to "Read and write", then generate:
- API Key + Secret (consumer keys)
- Access Token + Secret (under "Keys and tokens", generate with read/write access)

### 3. GitHub repo

`mayurski-art/trollrunner-terminal` — already created and pushed.

### 4. Vercel project

Vercel dashboard → Add New Project → import `trollrunner-terminal` → deploy with
defaults (Next.js auto-detected). Then:

- **Settings → Domains** — add `terminal.trollrunner.net`, point its DNS record
  (already created) at `cname.vercel-dns.com` if not already done.
- **Settings → Environment Variables** — add everything in `.env.example`:
  - `ANTHROPIC_API_KEY`
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (service role key, not anon —
    this project only calls Supabase server-side)
  - `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`
  - `CRON_SECRET` — any random string; Vercel automatically sends it as the
    `Authorization: Bearer <CRON_SECRET>` header on scheduled cron invocations.

Redeploy after setting env vars so the cron route can pick them up.

## Kill switch

To pause posting without touching env vars or redeploying:

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
is limited to once-per-day invocations — a sub-daily schedule like the current
`0 */6 * * *` requires a Pro plan.

## Adjusting the persona

The system prompt lives in `lib/persona.ts`. It's given the last 15 posts as context
on every generation so it doesn't repeat itself.
