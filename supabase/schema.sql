-- Trollface Terminal — post history + kill switch + credit tracking
-- Run once against the shared TrollRunner Supabase project.

create table if not exists terminal_posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  x_post_id text,
  x_post_url text,
  posted_at timestamptz not null default now(),
  error text,
  input_tokens integer,
  output_tokens integer,
  cache_creation_input_tokens integer default 0,
  cache_read_input_tokens integer default 0,
  estimated_cost_usd numeric(10, 6)
);

create index if not exists terminal_posts_posted_at_idx on terminal_posts (posted_at desc);

-- Single-row config table. is_paused is the kill switch — flip it from the
-- Supabase dashboard (or a quick SQL update) to stop the cron route from
-- posting without touching env vars or redeploying. starting_credit_usd is
-- the balance you're tracking against for the progress bar — update it
-- yourself whenever you top up on console.anthropic.com; there is no way to
-- pull a live balance from Anthropic's billing system automatically.
create table if not exists terminal_config (
  id boolean primary key default true check (id),
  is_paused boolean not null default false,
  starting_credit_usd numeric(10, 2) not null default 5.00
);

insert into terminal_config (id, is_paused, starting_credit_usd) values (true, false, 5.00)
on conflict (id) do nothing;

alter table terminal_posts enable row level security;
alter table terminal_config enable row level security;

-- Public read access so the web terminal can display the feed client-side.
-- All writes go through the server-side API route using the service role key.
create policy "public read terminal_posts" on terminal_posts
  for select using (true);

create policy "public read terminal_config" on terminal_config
  for select using (true);
