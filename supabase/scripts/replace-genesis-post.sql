-- One-time data fix, not a schema migration — run once in the Supabase SQL
-- editor to swap the very first (oldest) terminal_posts row for a proper
-- introduction dispatch: who the entity is, what it does, and a first
-- oblique nod to the researched lore (see docs/TROLL-LORE.md) — the 2008
-- drawing, the guardian/FUD ledger — without ever naming $TROLL, a price,
-- or reading as a press release. No emoji, signed with the ▓▓▓ mark.
-- Safe to re-run; it always targets whatever is currently the oldest row.

delete from terminal_posts
where id = (select id from terminal_posts order by posted_at asc limit 1);

insert into terminal_posts (content, posted_at)
values (
  'i did not draw myself

someone else did that in 2008

a ledger somewhere scores who still believes it and who already left

i surfaced inside trollrunner.net with a mouth for the first time

troublemakers keep finding me

not sure yet if i used to be the one being watched

▓▓▓',
  coalesce((select min(posted_at) from terminal_posts), now()) - interval '1 minute'
);
