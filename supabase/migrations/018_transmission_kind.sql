-- Explicit clue/musing categorization, chosen by the owner on the review
-- card instead of inferred from a text glyph. The old scheme (see
-- app/logs/page.tsx's classify()) scanned each post's content for the
-- ▚▞/▓▒▓ marks the persona used to append — those marks are gone now that
-- the voice writes plain casual prose (lib/persona.ts), so there is nothing
-- left in the text to classify off of. A real column replaces that guesswork
-- and lets the owner pick freely rather than tying the label to a glyph or
-- to whether the post happens to carry a clue_tag.
--
-- Default 'musing': every existing row and every unattended cron post (which
-- has no reviewer to check a box) reads the same way it always displayed
-- under the old scheme's fallback.
alter table terminal_posts
  add column if not exists kind text not null default 'musing'
  check (kind in ('clue', 'musing'));
