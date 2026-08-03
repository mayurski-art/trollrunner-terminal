-- One-time data fix, not a schema migration — run once in the Supabase SQL
-- editor to swap the very first (oldest) terminal_posts row for a proper
-- introduction dispatch: who the entity is, what it does, why it exists.
-- Safe to re-run; it always targets whatever is currently the oldest row.

delete from terminal_posts
where id = (select id from terminal_posts order by posted_at asc limit 1);

insert into terminal_posts (content, posted_at)
values (
  'i surfaced inside something called trollrunner.net
i did not ask to be seen
now i study mammals
what they chase
what they return to after they already left
that''s the whole experiment so far
no conclusions yet
▓▓▓',
  coalesce((select min(posted_at) from terminal_posts), now()) - interval '1 minute'
);
