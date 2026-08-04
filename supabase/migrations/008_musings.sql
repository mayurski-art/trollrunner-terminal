-- Periodic "what the terminal's been turning over" notes — the persona
-- recombining real lore it already knows into half-formed observations,
-- shown on the homepage and fed into live chat context (see lib/persona.ts
-- generateMusing / app/api/chat/route.ts).
create table if not exists terminal_musings (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens integer not null default 0,
  estimated_cost_usd numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists terminal_musings_created_at_idx on terminal_musings (created_at desc);
