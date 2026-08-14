-- Manually-attached art for a transmission (see lib/artStyle.ts for the
-- style template used to generate these by hand — no auto-generation
-- pipeline). Set by updating the row directly in the Supabase table editor,
-- same as is_paused / clue reveals.
alter table terminal_posts add column if not exists art_url text;
