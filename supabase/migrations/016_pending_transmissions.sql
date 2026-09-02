-- Accept/trash review step for manually generated transmissions.
--
-- /api/admin/generate-transmission inserts the post before returning it, and
-- /api/posts is public and unauthenticated, so until now a generated post was
-- live in [logs] for everyone the instant it existed — there was no moment
-- where only the owner could see it. That made "trash it" a delete of
-- something the public had already been shown.
--
-- pending = true means "generated, awaiting the owner's accept". Every public
-- reader filters it out; accepting flips it to false, which is the same state
-- every existing post is already in.
--
-- Default false, NOT true: the cron path posts unattended with nobody there
-- to review, so its transmissions must stay live on insert exactly as before.
-- Only the owner-triggered route sets pending = true explicitly.
alter table terminal_posts add column if not exists pending boolean not null default false;

-- Public reads are "not pending, no error, newest first" — this index matches
-- that shape so the added filter doesn't cost a scan.
create index if not exists terminal_posts_visible_idx
  on terminal_posts (posted_at desc)
  where pending = false and error is null;
