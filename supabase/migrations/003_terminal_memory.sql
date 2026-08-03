-- Trollface Terminal — user-pinned memory
-- Lets a troublemaker click "remember" on a message and have the terminal
-- carry that fact into every future conversation. Run once against the
-- shared TrollRunner Supabase project. Safe to run multiple times.

create table if not exists terminal_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'terminal')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists terminal_memories_user_idx
  on terminal_memories (user_id, created_at asc);

alter table terminal_memories enable row level security;

-- Users can read their own pinned memories (to show "remembered" state /
-- the manage list) and unpin their own. All inserts go through the
-- service-role /api/memory route, same trust model as chat messages.
create policy "users read own memories" on terminal_memories
  for select using (auth.uid() = user_id);
