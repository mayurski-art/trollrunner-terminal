-- Per-day API spend breakdown, owner-only, powers the [ reports ] page.
-- One row per finalized UTC day — see app/api/daily-report-cron/route.ts.

create table if not exists terminal_daily_spend_reports (
  report_date date primary key,
  chat_cost_usd numeric(10, 6) not null default 0,
  undervoice_cost_usd numeric(10, 6) not null default 0,
  posts_cost_usd numeric(10, 6) not null default 0,
  total_cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

alter table terminal_daily_spend_reports enable row level security;
-- No policies: service-role only, same as terminal_config — nothing here
-- is user-facing, only read via requireOwner-gated admin routes.
