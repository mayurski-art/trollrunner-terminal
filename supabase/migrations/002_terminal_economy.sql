-- Trollface Terminal v2 — live chat + PROBLEMS economy
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times (everything is `if not exists` / `on conflict do nothing`).

-- One row per chat turn (both user + terminal replies), tied to the shared
-- TrollRunner auth.users table.
create table if not exists terminal_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'terminal')),
  content text not null,
  qualifying boolean not null default false,
  input_tokens integer,
  output_tokens integer,
  cache_creation_input_tokens integer default 0,
  cache_read_input_tokens integer default 0,
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

create index if not exists terminal_chat_messages_user_idx
  on terminal_chat_messages (user_id, created_at desc);

-- One row per user: PROBLEMS balance + mining/rate-limit counters.
create table if not exists terminal_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  lifetime_earned integer not null default 0,
  lifetime_spent integer not null default 0,
  qualifying_count integer not null default 0, -- rolls over mod 7 -> mints 1
  messages_today integer not null default 0,
  last_message_at timestamptz,
  last_message_day date
);

-- Append-only ledger — balance is always re-derivable from this for audits.
create table if not exists terminal_token_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  reason text not null, -- 'mined' today; 'redeemed' / 'bonus' reserved for later
  created_at timestamptz not null default now()
);

create index if not exists terminal_token_ledger_user_idx
  on terminal_token_ledger (user_id, created_at desc);

-- Chat kill switch + global daily spend cap, alongside the existing
-- terminal_config row from the broadcast schema.
alter table terminal_config
  add column if not exists chat_paused boolean not null default false,
  add column if not exists chat_daily_global_cap integer not null default 1500,
  add column if not exists chat_messages_today integer not null default 0,
  add column if not exists chat_messages_day date;

alter table terminal_chat_messages enable row level security;
alter table terminal_wallets enable row level security;
alter table terminal_token_ledger enable row level security;

-- Users can read their own chat history / wallet / ledger. All writes go
-- through the service-role /api/chat route — same trust model as the
-- broadcast schema and the shared accounts system.
create policy "users read own chat messages" on terminal_chat_messages
  for select using (auth.uid() = user_id);

create policy "users read own ledger" on terminal_token_ledger
  for select using (auth.uid() = user_id);

-- Public read of wallets — needed for the top-miners ladder (balance only,
-- no message content, no PII).
create policy "public read wallets" on terminal_wallets
  for select using (true);
