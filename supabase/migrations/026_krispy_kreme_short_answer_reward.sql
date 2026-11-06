-- Krispy Kreme transmission reward correction.
-- Marks the latest guessable transmission whose answer tag identifies Krispy
-- Kreme as a short-answer transmission (+50 rather than the standard +10).
-- Trouble-makers who already cracked it have already received the +10 reward;
-- this credits the +40 difference exactly once per correct guess.

create table if not exists terminal_post_reward_adjustments (
  guess_id uuid primary key references terminal_post_guesses(id) on delete cascade,
  post_id uuid not null references terminal_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null check (delta = 40),
  created_at timestamptz not null default now()
);

DO $$
DECLARE
  target_post_id uuid;
BEGIN
  select id into target_post_id
  from terminal_posts
  where clue_tag ilike '%krispy kreme%'
    and coalesce(error, '') = ''
  order by posted_at desc
  limit 1;

  if target_post_id is null then
    raise exception 'Could not find a Krispy Kreme transmission by clue_tag; no reward changes were applied.';
  end if;

  update terminal_posts
  set short_answer = true
  where id = target_post_id;

  -- Claim each previously correct guess once, then apply its +40 delta to
  -- balance, lifetime-earned, and the append-only token ledger.
  WITH adjustments AS (
    insert into terminal_post_reward_adjustments (guess_id, post_id, user_id, delta)
    select g.id, g.post_id, g.user_id, 40
    from terminal_post_guesses g
    where g.post_id = target_post_id
      and g.correct = true
    on conflict (guess_id) do nothing
    returning user_id, delta
  ), wallet_updates AS (
    insert into terminal_wallets (user_id, balance, lifetime_earned)
    select user_id, sum(delta), sum(delta)
    from adjustments
    group by user_id
    on conflict (user_id) do update
      set balance = terminal_wallets.balance + excluded.balance,
          lifetime_earned = terminal_wallets.lifetime_earned + excluded.lifetime_earned
  )
  insert into terminal_token_ledger (user_id, delta, reason)
  select user_id, delta, 'post_guess_short_answer_adjustment'
  from adjustments;
END $$;
