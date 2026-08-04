-- Trollface Terminal — buddy system
-- Tracks how much a troublemaker has talked to the terminal, independent of
-- PROBLEMS mining, so a friendlier troublemaker occasionally gets a random
-- bonus mint. See lib/buddy.ts for tiers + odds. Run once against the shared
-- TrollRunner Supabase project. Safe to run multiple times.

alter table terminal_wallets
  add column if not exists friendship_score integer not null default 0;
