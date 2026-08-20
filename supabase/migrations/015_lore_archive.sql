-- The lore archive — docs/TERMINAL-V4-DESIGN.md §3. Every numbered section
-- of docs/TROLL-LORE.md becomes a "file" a troublemaker recovers, either by
-- talking about its topic in chat (free, source='chat') or by spending
-- PROBLEMS to force it open (source='purchase'). 'undervoice' and 'seed'
-- are reserved for v4 §3.2 Path C and the seeded-open set respectively —
-- not written by any route yet, included now so the check constraint
-- doesn't need a second migration when those land.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

create table if not exists terminal_lore_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section_number integer not null,
  source text not null check (source in ('chat', 'purchase', 'undervoice', 'seed')),
  created_at timestamptz not null default now(),
  unique (user_id, section_number)
);

create index if not exists terminal_lore_unlocks_user_idx
  on terminal_lore_unlocks (user_id);

alter table terminal_lore_unlocks enable row level security;

-- Users read only their own unlocks (the manifest route needs this to know
-- what to show as OPEN vs SEALED). All writes go through the service-role
-- /api/archive route — same trust model as every other economy table.
create policy "users read own lore unlocks" on terminal_lore_unlocks
  for select using (auth.uid() = user_id);

alter table terminal_config
  add column if not exists archive_unlock_cost integer not null default 1,
  add column if not exists archive_deep_unlock_cost integer not null default 3;
