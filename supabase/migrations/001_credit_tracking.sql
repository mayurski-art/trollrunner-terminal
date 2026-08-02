-- Run this once against your existing Supabase project to add token/cost
-- tracking to a database that was already set up from an earlier version
-- of supabase/schema.sql. Safe to run multiple times.

alter table terminal_posts add column if not exists input_tokens integer;
alter table terminal_posts add column if not exists output_tokens integer;
alter table terminal_posts add column if not exists cache_creation_input_tokens integer default 0;
alter table terminal_posts add column if not exists cache_read_input_tokens integer default 0;
alter table terminal_posts add column if not exists estimated_cost_usd numeric(10, 6);

alter table terminal_config add column if not exists starting_credit_usd numeric(10, 2) not null default 5.00;
