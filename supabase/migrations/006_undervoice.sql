-- Trollface Terminal v3 — the Undervoice
-- A second, gated entity: pay a session's worth of PROBLEMS out of the
-- existing wallet to open a bounded conversation. See docs/TERMINAL-V3-DESIGN.md.
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

create table if not exists terminal_undervoice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  cost_paid integer not null,
  message_count integer not null default 0,
  outcome text check (outcome in ('refund', 'bonus', 'charge', 'none')),
  outcome_delta integer,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists terminal_undervoice_sessions_user_idx
  on terminal_undervoice_sessions (user_id, opened_at desc);

-- Partial unique index: at most one OPEN session per user at a time.
create unique index if not exists terminal_undervoice_sessions_one_open_idx
  on terminal_undervoice_sessions (user_id) where (status = 'open');

create table if not exists terminal_undervoice_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references terminal_undervoice_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'terminal')),
  content text not null,
  mood text check (mood in ('genuine', 'clever', 'hollow', 'hostile', 'flat')),
  input_tokens integer,
  output_tokens integer,
  cache_creation_input_tokens integer default 0,
  cache_read_input_tokens integer default 0,
  estimated_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);

create index if not exists terminal_undervoice_messages_session_idx
  on terminal_undervoice_messages (session_id, created_at asc);

alter table terminal_config
  add column if not exists undervoice_paused boolean not null default false,
  add column if not exists undervoice_session_cost integer not null default 5,
  add column if not exists undervoice_max_messages integer not null default 8;

alter table terminal_undervoice_sessions enable row level security;
alter table terminal_undervoice_messages enable row level security;

create policy "users read own undervoice sessions" on terminal_undervoice_sessions
  for select using (auth.uid() = user_id);

create policy "users read own undervoice messages" on terminal_undervoice_messages
  for select using (
    exists (
      select 1 from terminal_undervoice_sessions s
      where s.id = terminal_undervoice_messages.session_id
        and s.user_id = auth.uid()
    )
  );

-- All writes go through the service-role /api/undervoice route — same
-- trust model as terminal_chat_messages / terminal_wallets.

-- terminal_token_ledger.reason gains four new free-text values, no schema
-- change needed (already `text`): 'undervoice_spend', 'undervoice_refund',
-- 'undervoice_bonus', 'undervoice_extra_charge'.
