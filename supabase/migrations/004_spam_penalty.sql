-- Trollface Terminal — anti-spam mining penalty
-- Tracks consecutive spammy messages (near-duplicates / looped filler) from
-- a user so repeated abuse costs them PROBLEMS instead of just being quietly
-- ignored. Run once against the shared TrollRunner Supabase project. Safe to
-- run multiple times.

alter table terminal_wallets
  add column if not exists spam_streak integer not null default 0;
