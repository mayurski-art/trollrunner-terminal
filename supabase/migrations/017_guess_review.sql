-- Manual review for transmission guesses. gradeGuess() (lib/musingGuess.ts)
-- is a blunt word-overlap heuristic — a guess can be obviously right to a
-- human and still miss the 0.6 token-overlap bar. This lets the owner see
-- what people actually typed and flip a wrongly-denied guess to correct,
-- paying out the same refund + bonus the auto-grader would have.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

alter table terminal_post_guesses
  add column if not exists last_guess_text text,
  add column if not exists overridden_by text;

-- overridden_by holds the owner username who flipped the verdict (null =
-- untouched, still whatever gradeGuess() decided). Kept separate from
-- `correct` itself so the admin UI can show "auto" vs "overridden" without
-- guessing from other fields.

-- terminal_token_ledger.reason gains one new free-text value, no schema
-- change needed (already `text`): 'post_guess_override'.
