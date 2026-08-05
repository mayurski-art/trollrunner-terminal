-- Public guessing game for broadcast clues — mirrors
-- 009_musing_guess.sql's terminal_musing_guesses exactly, one table per
-- guessable surface (musings vs voice transmissions). Grading stays shared
-- (lib/musingGuess.ts). Run once against the shared TrollRunner Supabase
-- project. Safe to run multiple times.

create table if not exists terminal_post_guesses (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references terminal_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  correct boolean not null default false,
  resolved boolean not null default false,
  cost_paid integer not null default 0,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (post_id, user_id)
);

create index if not exists terminal_post_guesses_user_idx
  on terminal_post_guesses (user_id, created_at desc);

alter table terminal_post_guesses enable row level security;

create policy "users read own post guesses" on terminal_post_guesses
  for select using (auth.uid() = user_id);

-- All writes go through the service-role /api/post-guess route.

-- terminal_token_ledger.reason gains two new free-text values, no schema
-- change needed (already `text`): 'post_guess_spend', 'post_guess_correct'.
