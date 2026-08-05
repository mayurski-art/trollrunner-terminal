-- Broadcast clues — each voice transmission now carries a private clue_tag
-- (the concrete lore/event it's actually circling, same idea as musings'
-- answer_tag), visible to no one through the public API. Owner-only reveal
-- via /api/admin/latest-clue, same requireOwner() pattern as /inspect.
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

alter table terminal_posts
  add column if not exists clue_tag text;

-- terminal_posts previously had no RLS (fine when every column was already
-- public via /api/posts' explicit column list). Now that clue_tag is a
-- secret, lock the table to service-role access only — the public anon key
-- would otherwise be able to read it straight off PostgREST, bypassing
-- /api/posts' column allowlist entirely. Nothing in the app queries this
-- table from the browser; every read already goes through an API route
-- using the service-role client.
alter table terminal_posts enable row level security;
