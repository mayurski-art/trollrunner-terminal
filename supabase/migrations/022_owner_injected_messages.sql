-- Marks a terminal message the owner wrote by hand, rather than one a model
-- generated — see app/api/admin/say/route.ts and docs/LIVE-HOP-IN-DESIGN.md.
--
-- The troublemaker must never be able to tell the two apart, so this column
-- is never sent to their client: app/api/chat/stream/route.ts and
-- app/api/chat/route.ts both select an explicit display-column list that
-- leaves it out. It exists for the owner's side of the glass:
--
--   * re-reading a transcript later and telling your own voice from the
--     model's,
--   * auditing which lines were injected, and
--   * letting the persona's history builder know a line was human-written,
--     if that ever matters for context.
--
-- Defaulted false rather than nullable: every existing row genuinely was
-- generated, so false is a true statement about all of them, not a guess.
-- The insert in /api/admin/say retries without this column if the migration
-- hasn't been run, so hop-in works before this lands.
alter table terminal_chat_messages
  add column if not exists from_owner boolean not null default false;
