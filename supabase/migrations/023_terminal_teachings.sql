-- Standing rules troll_runner teaches the terminal by chatting with it —
-- see lib/teachings.ts.
--
-- The owner-voice sample (lib/ownerVoice.ts) only ever nudged STYLE, and it
-- told the model outright not to treat those lines as instructions — so
-- "when someone says trolololol, answer trololololol..." was read as a
-- flavour sample and never followed. It also lived in the owner's own chat
-- rows, which [clear] deletes. Rules here are global (every troublemaker's
-- chat gets them), are followed as instructions, and survive a clear.
--
-- Written and read only by the service role; no client ever touches it.
--
-- Run once against the shared TrollRunner Supabase project. Safe to run
-- multiple times.

create table if not exists terminal_teachings (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  -- The owner message the rule was taken from, for auditing what it heard.
  source_message text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists terminal_teachings_active_idx
  on terminal_teachings (active, created_at);

alter table terminal_teachings enable row level security;

-- The rule troll_runner taught before this table existed — lost when that
-- conversation was cleared.
insert into terminal_teachings (content, source_message)
select
  'When a troublemaker says "trolololol" (or any spelling of trolol...), reply with exactly: trolololololololololololololololololololololololololololololololol',
  'seeded by migration 023'
where not exists (select 1 from terminal_teachings where source_message = 'seeded by migration 023');
