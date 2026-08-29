---
name: terminalcredits
description: Show the trollrunner-terminal Anthropic API credit usage as a text progress bar, right here in the chat — never on the website. Triggers on "/terminalcredits".
---

# terminalcredits

A private, VS Code/agent-only readout of how much of the
`console.anthropic.com` balance behind `trollrunner-terminal` has been
spent. This mirrors `README.md`'s "Credit tracking" section — same private,
not-visitor-facing check — just surfaced here instead of buried in a
network response.

## What to do when this triggers

1. Read the figures straight from Supabase, using `SUPABASE_URL` +
   `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, and compute the same way
   `lib/budget.ts`'s `getRemainingUsd` does: sum `estimated_cost_usd` across
   `terminal_posts`, `terminal_chat_messages`, `terminal_undervoice_messages`
   and `terminal_musings`, then subtract from
   `terminal_config.starting_credit_usd`.

   (The old `curl /api/posts | jq '.usage'` no longer works — that field was
   removed because it leaked spend data to every anonymous visitor. The
   authenticated equivalent is `GET /api/admin/credits`, but it needs a
   `troll_runner` bearer token, so reading the DB directly is simpler here.)

   The computed summary includes
   `startingCreditUsd`, `spentUsd`, `remainingUsd`, `percentUsed` — this
   already sums **both** the daily-broadcast cost (`terminal_posts`) and the
   live-chat cost (`terminal_chat_messages`), since both draw against the
   same API key/balance.

2. Render a block-character meter from `percentUsed` (20 cells wide, same
   scale `lib/ascii.ts`'s `blockMeter()` uses on the site itself):

   ```
   filled = round(percentUsed / 100 * 20)
   bar = "█".repeat(filled) + "░".repeat(20 - filled)
   ```

3. Reply directly in the chat — do **not** write this to any file, commit
   it, or add it to the website UI. It's for the user's eyes only, right
   here. Format like:

   ```
   TERMINAL API CREDITS
   ████████░░░░░░░░░░░░ 41%

   spent:     $2.05
   remaining: $2.95
   starting:  $5.00
   ```

4. If the fetch fails (endpoint down, no `usage` field, etc.), say so
   plainly instead of guessing numbers — don't fabricate a bar.
