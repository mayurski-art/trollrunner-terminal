-- Muse guessing game — each musing now carries a private answer_tag (the
-- concrete lore/event it's actually circling, never shown via /api/musings).
-- Spend 1 PROBLEM to get up to 2 guesses at it; a correct guess refunds the
-- cost plus a bonus. Grading logic lives in lib/musingGuess.ts, same
-- separation as the Undervoice: nothing here is decided by the model.
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

alter table terminal_musings
  add column if not exists answer_tag text;

-- terminal_musings previously had no RLS (fine when it only held public
-- content). Now that answer_tag is a secret, lock the table to service-role
-- access only — the public anon key would otherwise be able to read it
-- straight off PostgREST, bypassing /api/musings' column allowlist entirely.
-- Nothing in the app queries this table from the browser; every read
-- already goes through an API route using the service-role client.
alter table terminal_musings enable row level security;

create table if not exists terminal_musing_guesses (
  id uuid primary key default gen_random_uuid(),
  musing_id uuid not null references terminal_musings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  correct boolean not null default false,
  resolved boolean not null default false,
  cost_paid integer not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (musing_id, user_id)
);

create index if not exists terminal_musing_guesses_user_idx
  on terminal_musing_guesses (user_id, created_at desc);

alter table terminal_musing_guesses enable row level security;

create policy "users read own musing guesses" on terminal_musing_guesses
  for select using (auth.uid() = user_id);

-- All writes go through the service-role /api/musing-guess route — same
-- trust model as terminal_undervoice_sessions / terminal_wallets.

-- terminal_token_ledger.reason gains two new free-text values, no schema
-- change needed (already `text`): 'musing_guess_spend', 'musing_guess_correct'.
