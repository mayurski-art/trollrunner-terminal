-- Wallet submissions — docs/VAULT-TROLL-REWARDS.md Path A (Phase 1).
--
-- A troublemaker pastes a Solana address in [vault] asking to be considered
-- for a manual $TROLL airdrop. The operator reviews the queue in [inspect]
-- and sends from their own wallet by hand. Nothing in this schema, and
-- nothing in the routes that write it, ever moves a token: amount_troll and
-- tx_signature are a record of something the operator already did
-- elsewhere, never an instruction to do it.
--
-- A submission is a REQUEST FOR CONSIDERATION, not an entitlement. No
-- PROBLEMS are spent to file one and none are refunded when one is skipped;
-- the PROBLEMS redemption path (Path B) is a separate system with its own
-- tables and is not part of this migration.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

create table if not exists terminal_wallet_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  status text not null default 'pending' check (status in ('pending', 'airdropped', 'skipped')),
  -- Operator-entered record of a transfer made by hand, outside this app.
  amount_troll numeric,
  tx_signature text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  -- One active submission per user: re-submitting updates the address in
  -- place rather than filling the queue with duplicates from one person.
  unique (user_id)
);

create index if not exists terminal_wallet_submissions_status_idx
  on terminal_wallet_submissions (status, created_at desc);

alter table terminal_wallet_submissions enable row level security;

-- Users read only their own submission — [vault] needs this to show "you're
-- in the queue" and the status back to the person who filed it. Every write
-- goes through the service-role routes (/api/vault/wallet for the user,
-- /api/admin/wallet-submissions for the operator), same trust model as
-- every other economy table in this project.
create policy "users read own wallet submission" on terminal_wallet_submissions
  for select using (auth.uid() = user_id);
