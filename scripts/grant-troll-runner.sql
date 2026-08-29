-- One-off: unlock every archive section and set a 42069 PROBLEMS balance
-- for the troll_runner account. Paste into the Supabase SQL editor for this
-- project and run once. Not part of any migration — this is account data,
-- not schema.

do $$
declare
  target_user_id uuid;
begin
  select id into target_user_id
  from auth.users
  where raw_user_meta_data ->> 'username' = 'troll_runner'
  limit 1;

  if target_user_id is null then
    raise exception 'no auth.users row with username = troll_runner';
  end if;

  -- Balance: set both balance and lifetime_earned so the ledger view and
  -- any "lifetime mined" stat stay consistent with the new balance rather
  -- than showing an earned total lower than the current balance.
  insert into terminal_wallets (user_id, balance, lifetime_earned)
  values (target_user_id, 42069, 42069)
  on conflict (user_id) do update
    set balance = 42069,
        lifetime_earned = greatest(terminal_wallets.lifetime_earned, 42069);

  -- Unlock every numbered section in docs/TROLL-LORE.md. 47 sections exist
  -- as of this writing (lib/loreSections.ts parses "## N." headings); the
  -- generate_series upper bound is padded to 60 and the insert is a no-op
  -- for any number the archive doesn't actually serve.
  insert into terminal_lore_unlocks (user_id, section_number, source)
  select target_user_id, n, 'seed'
  from generate_series(1, 60) as n
  on conflict (user_id, section_number) do nothing;

  raise notice 'done for user_id = %', target_user_id;
end $$;
