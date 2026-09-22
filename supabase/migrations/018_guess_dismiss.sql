-- The [ review ] page's "dismiss" button only ever set client-side React
-- state, so a dismissed guess reappeared on every refresh. This adds a real
-- persisted flag so dismissal sticks.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

alter table terminal_post_guesses
  add column if not exists dismissed boolean not null default false;
