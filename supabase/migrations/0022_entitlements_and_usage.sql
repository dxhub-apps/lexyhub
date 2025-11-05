-- ===========================================
-- 0022_entitlements_and_usage.sql
-- Plan entitlements and monthly usage counters
-- ===========================================

-- migrate:up

-- Plan entitlements define quota limits per plan tier
create table if not exists public.plan_entitlements (
  plan_code text primary key,
  searches_per_month int not null,
  niches_max int not null,
  ai_opportunities_per_month int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_entitlements is 'Quota limits per plan tier (free, basic, pro). -1 means unlimited.';

-- Seed entitlements for free, basic, pro plans
insert into public.plan_entitlements (plan_code, searches_per_month, niches_max, ai_opportunities_per_month) values
  ('free', 10, 1, 2),
  ('basic', 100, 10, 999),
  ('pro', -1, -1, -1)
on conflict (plan_code) do update set
  searches_per_month = excluded.searches_per_month,
  niches_max = excluded.niches_max,
  ai_opportunities_per_month = excluded.ai_opportunities_per_month,
  updated_at = now();

-- Legacy plan mapping (spark → basic, scale → pro, apex → pro)
insert into public.plan_entitlements (plan_code, searches_per_month, niches_max, ai_opportunities_per_month) values
  ('spark', 100, 10, 999),
  ('scale', -1, -1, -1),
  ('apex', -1, -1, -1)
on conflict (plan_code) do update set
  searches_per_month = excluded.searches_per_month,
  niches_max = excluded.niches_max,
  ai_opportunities_per_month = excluded.ai_opportunities_per_month,
  updated_at = now();

-- Usage counters track monthly consumption per user
create table if not exists public.usage_counters (
  user_id uuid not null,
  period_start date not null,
  key text not null,  -- 'searches' | 'ai_opportunities' | 'niches'
  value int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period_start, key)
);

comment on table public.usage_counters is 'Monthly usage counters per user. Period resets on 1st of each month.';

create index if not exists usage_counters_user_period_idx
  on public.usage_counters(user_id, period_start desc);

-- migrate:down

drop index if exists usage_counters_user_period_idx;
drop table if exists public.usage_counters cascade;
drop table if exists public.plan_entitlements cascade;
