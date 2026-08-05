-- Hard daily USD spend cap + low-balance backstop, alongside the existing
-- message-count caps (chat_daily_global_cap etc.) which don't actually
-- bound spend in dollars. See lib/budget.ts.

alter table terminal_config
  add column if not exists daily_spend_cap_usd numeric(10, 4) not null default 1.50,
  add column if not exists spend_today_usd numeric(10, 6) not null default 0,
  add column if not exists spend_day date,
  add column if not exists low_balance_pause_usd numeric(10, 2) not null default 2.00;
