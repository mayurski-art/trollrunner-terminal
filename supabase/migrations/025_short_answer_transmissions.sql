-- Short-answer transmissions pay a larger reward than regular riddles.
-- This flag marks a faster/smaller challenge whose correct answer is worth +50
-- PROBLEMS instead of the normal +10.

alter table terminal_posts
  add column if not exists short_answer boolean not null default false;
