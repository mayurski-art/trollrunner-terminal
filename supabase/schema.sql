-- Trollface Terminal — post history + kill switch
-- Run once against the shared TrollRunner Supabase project.

create table if not exists terminal_posts (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  x_post_id text,
  x_post_url text,
  posted_at timestamptz not null default now(),
  error text
);

create index if not exists terminal_posts_posted_at_idx on terminal_posts (posted_at desc);

-- Single-row config table. is_paused is the kill switch — flip it from the
-- Supabase dashboard (or a quick SQL update) to stop the cron route from
-- posting without touching env vars or redeploying.
create table if not exists terminal_config (
  id boolean primary key default true check (id),
  is_paused boolean not null default false
);

insert into terminal_config (id, is_paused) values (true, false)
on conflict (id) do nothing;

alter table terminal_posts enable row level security;
alter table terminal_config enable row level security;

-- Public read access so the web terminal can display the feed client-side.
-- All writes go through the server-side API route using the service role key.
create policy "public read terminal_posts" on terminal_posts
  for select using (true);

create policy "public read terminal_config" on terminal_config
  for select using (true);
