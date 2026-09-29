-- Automatic per-troublemaker memory — see lib/autoMemory.ts.
--
-- Replaces clicking [remember] on individual lines: every few turns a small
-- Claude call folds the recent conversation into a short set of notes about
-- this person (what they go by, what they care about, running jokes, things
-- they asked the terminal to keep in mind). The notes ride along in every
-- chat prompt, and [clear] deliberately leaves them alone — clearing wipes
-- the transcript, not the terminal's memory of who you are. Pinned rows in
-- terminal_memories from before this still load alongside.
--
-- One row per account. Written and read only by the service role.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

create table if not exists terminal_user_notes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  notes text not null default '',
  -- User turns since the notes were last rewritten; the rewrite runs when
  -- this reaches lib/autoMemory.ts's UPDATE_EVERY, and on [clear].
  turns_since_update integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table terminal_user_notes enable row level security;
