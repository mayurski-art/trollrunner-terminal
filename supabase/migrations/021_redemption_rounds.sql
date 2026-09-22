-- PROBLEMS -> $TROLL redemption — docs/VAULT-TROLL-REWARDS.md Path B
-- (Phases 2-4). Round 1's rate is 69 PROBLEMS = 1 TROLL.
--
-- Why rounds exist at all: PROBLEMS are uncapped and cost ~7 chat messages
-- each, so a permanently published rate is a standing promise denominated
-- in an asset that may appreciate a great deal. Instead the operator opens
-- a round with a rate and a pool cap, and can close it and open the next
-- one at a different rate. /vault only ever shows THIS round's rate.
--
-- As with Path A, nothing here moves a token. Approving a request records
-- a transfer the operator made by hand from their own wallet.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

create table if not exists terminal_redemption_rounds (
  id uuid primary key default gen_random_uuid(),
  -- How many PROBLEMS buy 1 TROLL in this round. 69 for round 1.
  problems_per_troll numeric not null check (problems_per_troll > 0),
  -- Ceiling on what this round can pay out, in TROLL.
  pool_troll numeric not null check (pool_troll >= 0),
  -- Per-user ceiling on PROBLEMS spent in this round; null = no cap.
  per_user_cap integer check (per_user_cap is null or per_user_cap > 0),
  is_open boolean not null default true,
  label text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Only one round open at a time (§4.1). The partial unique index makes the
-- database enforce it rather than trusting the route: with the WHERE
-- clause, only open rows are indexed, so a second is_open = true insert
-- collides while any number of closed rounds coexist.
create unique index if not exists terminal_redemption_rounds_one_open
  on terminal_redemption_rounds (is_open) where is_open;

create table if not exists terminal_redemption_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id uuid not null references terminal_redemption_rounds(id) on delete restrict,
  problems_spent integer not null check (problems_spent > 0),
  -- Frozen at request time: editing a round's rate later must never
  -- restate what an already-filed request was promised.
  rate_at_request numeric not null check (rate_at_request > 0),
  -- Also frozen — the address as given when the request was filed, so a
  -- later wallet change can't silently redirect a pending payout.
  address text not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded')),
  amount_troll numeric,
  tx_signature text,
  note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists terminal_redemption_requests_status_idx
  on terminal_redemption_requests (status, created_at desc);

create index if not exists terminal_redemption_requests_user_idx
  on terminal_redemption_requests (user_id, created_at desc);

alter table terminal_redemption_rounds enable row level security;
alter table terminal_redemption_requests enable row level security;

-- Anyone may read the open round: /vault has to show the current rate to
-- signed-out visitors too. Closed rounds stay hidden so the page can't be
-- mined for a rate history that looks like a published schedule.
create policy "anyone reads the open round" on terminal_redemption_rounds
  for select using (is_open);

-- Users read only their own requests.
create policy "users read own redemption requests" on terminal_redemption_requests
  for select using (auth.uid() = user_id);

-- All writes go through the service-role routes (/api/vault/redeem-troll
-- for users, /api/admin/redemptions for the operator).

-- Seed round 1 at the rate locked in the design doc. Guarded so re-running
-- this file never opens a second round or resets a rate the operator has
-- since changed.
insert into terminal_redemption_rounds (problems_per_troll, pool_troll, per_user_cap, is_open, label)
select 69, 175, 500, true, 'round 1'
where not exists (select 1 from terminal_redemption_rounds);
