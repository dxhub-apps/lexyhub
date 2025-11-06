-- ===========================================
-- 0032_pricing_strategy_implementation.sql
-- Comprehensive pricing strategy: Free, Basic, Pro, and Growth tiers
-- ===========================================

-- migrate:up

-- 1) Add trial and extension boost tracking to user_profiles
alter table public.user_profiles
  add column if not exists trial_expires_at timestamptz,
  add column if not exists extension_free_plus_expires_at timestamptz;

comment on column public.user_profiles.trial_expires_at is 'Trial expiration timestamp for temporary tier upgrades.';
comment on column public.user_profiles.extension_free_plus_expires_at is 'Free+ tier expiration for Chrome extension users (30-day boost).';

-- 2) Add Growth tier to plan_entitlements with redesigned limits
-- New tier structure:
--   Free:   10 searches,   1 niche,  10 AI opportunities
--   Basic:  100 searches,  10 niches, 100 AI opportunities ($6.99/mo)
--   Pro:    500 searches,  50 niches, 500 AI opportunities ($12.99/mo)
--   Growth: unlimited (-1) for all metrics ($24.99/mo, hidden tier)

-- Update existing tiers and add Growth
insert into public.plan_entitlements (plan_code, searches_per_month, niches_max, ai_opportunities_per_month) values
  ('growth', -1, -1, -1)
on conflict (plan_code) do update set
  searches_per_month = excluded.searches_per_month,
  niches_max = excluded.niches_max,
  ai_opportunities_per_month = excluded.ai_opportunities_per_month,
  updated_at = now();

-- Update Free tier to use consistent limits
update public.plan_entitlements
set searches_per_month = 10,
    niches_max = 1,
    ai_opportunities_per_month = 10,
    updated_at = now()
where plan_code = 'free';

-- Update Basic tier (and legacy spark mapping)
update public.plan_entitlements
set searches_per_month = 100,
    niches_max = 10,
    ai_opportunities_per_month = 100,
    updated_at = now()
where plan_code in ('basic', 'spark');

-- Update Pro tier with new limits (not unlimited anymore)
update public.plan_entitlements
set searches_per_month = 500,
    niches_max = 50,
    ai_opportunities_per_month = 500,
    updated_at = now()
where plan_code = 'pro';

-- Keep legacy scale/apex as unlimited for backwards compatibility
update public.plan_entitlements
set searches_per_month = -1,
    niches_max = -1,
    ai_opportunities_per_month = -1,
    updated_at = now()
where plan_code in ('scale', 'apex');

-- 3) Create extension boost mapping for all tiers (not just free)
-- Extension users get 2.5x boost on Free tier for 30 days after install
update public.plan_entitlements_extension
set searches_per_month = 25,
    niches_max = 3,
    ai_opportunities_per_month = 25,
    updated_at = now()
where plan_code = 'free';

-- 4) Create plan_limits reference table for UI display and pricing page
create table if not exists public.plan_limits (
  plan_code text primary key,
  display_name text not null,
  price_monthly_cents int not null,
  price_annual_cents int not null,
  stripe_price_id_monthly text,
  stripe_price_id_annual text,
  searches_per_month int not null,
  niches_max int not null,
  ai_opportunities_per_month int not null,
  keywords_storage_max int not null default -1,
  features jsonb default '[]'::jsonb,
  is_hidden boolean default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_limits is 'Pricing tier definitions with Stripe price IDs and feature lists.';
comment on column public.plan_limits.is_hidden is 'Hidden tiers (like Growth) are not shown publicly but can be offered via upsell.';
comment on column public.plan_limits.keywords_storage_max is 'Maximum keywords that can be saved. -1 means unlimited.';

-- Seed plan_limits (Stripe price IDs to be updated after creation)
insert into public.plan_limits (
  plan_code,
  display_name,
  price_monthly_cents,
  price_annual_cents,
  searches_per_month,
  niches_max,
  ai_opportunities_per_month,
  keywords_storage_max,
  features,
  is_hidden,
  sort_order
) values
  (
    'free',
    'Free',
    0,
    0,
    10,
    1,
    10,
    50,
    '["Basic keyword research", "1 niche tracking", "10 AI opportunities", "Extension support"]'::jsonb,
    false,
    1
  ),
  (
    'basic',
    'Basic',
    699,
    6990,
    100,
    10,
    100,
    500,
    '["100 monthly searches", "10 niche projects", "100 AI opportunities", "Email support", "Chrome extension boost"]'::jsonb,
    false,
    2
  ),
  (
    'pro',
    'Pro',
    1299,
    12990,
    500,
    50,
    500,
    5000,
    '["500 monthly searches", "50 niche projects", "500 AI opportunities", "Priority support", "Advanced analytics", "Trend forecasting"]'::jsonb,
    false,
    3
  ),
  (
    'growth',
    'Growth',
    2499,
    24990,
    -1,
    -1,
    -1,
    -1,
    '["Unlimited searches", "Unlimited niches", "Unlimited AI opportunities", "White-glove support", "Custom integrations", "API access", "Team collaboration"]'::jsonb,
    true,
    4
  )
on conflict (plan_code) do update set
  display_name = excluded.display_name,
  price_monthly_cents = excluded.price_monthly_cents,
  price_annual_cents = excluded.price_annual_cents,
  searches_per_month = excluded.searches_per_month,
  niches_max = excluded.niches_max,
  ai_opportunities_per_month = excluded.ai_opportunities_per_month,
  keywords_storage_max = excluded.keywords_storage_max,
  features = excluded.features,
  is_hidden = excluded.is_hidden,
  sort_order = excluded.sort_order,
  updated_at = now();

-- 5) Create usage_warnings table to track when users are notified about approaching limits
create table if not exists public.usage_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  quota_key text not null,  -- 'searches' | 'ai_opportunities' | 'niches'
  threshold_percent int not null,  -- 80, 90, 100
  warning_sent_at timestamptz not null default now(),
  period_start date not null,
  usage_at_warning int not null,
  limit_at_warning int not null,
  unique(user_id, quota_key, threshold_percent, period_start)
);

comment on table public.usage_warnings is 'Tracks when users have been warned about approaching quota limits to prevent spam.';

create index if not exists usage_warnings_user_period_idx
  on public.usage_warnings(user_id, period_start desc);

-- 6) Create upsell_triggers table to track Growth plan upsell opportunities
create table if not exists public.upsell_triggers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  trigger_type text not null,  -- 'quota_exceeded' | 'feature_locked' | 'heavy_usage' | 'admin_offer'
  target_plan text not null default 'growth',
  trigger_context jsonb default '{}'::jsonb,
  shown_at timestamptz,
  clicked_at timestamptz,
  converted_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.upsell_triggers is 'Tracks Growth tier upsell opportunities and conversion funnel.';

create index if not exists upsell_triggers_user_created_idx
  on public.upsell_triggers(user_id, created_at desc);

create index if not exists upsell_triggers_type_shown_idx
  on public.upsell_triggers(trigger_type, shown_at nulls first);

-- 7) Create pricing_analytics table to track pricing page interactions
create table if not exists public.pricing_analytics (
  id bigserial primary key,
  user_id uuid,
  session_id text,
  event_type text not null,  -- 'page_view' | 'tier_clicked' | 'checkout_started' | 'checkout_completed' | 'checkout_abandoned'
  plan_code text,
  billing_cycle text,  -- 'monthly' | 'annual'
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.pricing_analytics is 'Conversion funnel tracking for pricing page and checkout flow.';

create index if not exists pricing_analytics_event_created_idx
  on public.pricing_analytics(event_type, created_at desc);

create index if not exists pricing_analytics_user_idx
  on public.pricing_analytics(user_id, created_at desc) where user_id is not null;

-- 8) Create stripe_price_mappings table for environment-specific Stripe price IDs
create table if not exists public.stripe_price_mappings (
  id uuid primary key default gen_random_uuid(),
  plan_code text not null,
  billing_cycle text not null,  -- 'monthly' | 'annual'
  stripe_price_id text not null unique,
  environment text not null default 'production',  -- 'test' | 'production'
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_code, billing_cycle, environment)
);

comment on table public.stripe_price_mappings is 'Maps plan codes to Stripe price IDs per environment for checkout.';

-- Seed with placeholder test price IDs (to be replaced with actual Stripe IDs)
insert into public.stripe_price_mappings (plan_code, billing_cycle, stripe_price_id, environment) values
  ('basic', 'monthly', 'price_basic_monthly_test', 'test'),
  ('basic', 'annual', 'price_basic_annual_test', 'test'),
  ('pro', 'monthly', 'price_pro_monthly_test', 'test'),
  ('pro', 'annual', 'price_pro_annual_test', 'test'),
  ('growth', 'monthly', 'price_growth_monthly_test', 'test'),
  ('growth', 'annual', 'price_growth_annual_test', 'test')
on conflict (plan_code, billing_cycle, environment) do nothing;

-- Grant permissions
grant select on public.plan_limits to authenticated, service_role;
grant all on public.usage_warnings to service_role;
grant select, insert on public.usage_warnings to authenticated;
grant all on public.upsell_triggers to service_role;
grant select, insert on public.upsell_triggers to authenticated;
grant all on public.pricing_analytics to service_role;
grant insert on public.pricing_analytics to authenticated, anon;
grant select on public.stripe_price_mappings to authenticated, service_role;
grant all on public.stripe_price_mappings to service_role;

-- migrate:down

drop index if exists pricing_analytics_user_idx;
drop index if exists pricing_analytics_event_created_idx;
drop table if exists public.pricing_analytics cascade;

drop index if exists upsell_triggers_type_shown_idx;
drop index if exists upsell_triggers_user_created_idx;
drop table if exists public.upsell_triggers cascade;

drop index if exists usage_warnings_user_period_idx;
drop table if exists public.usage_warnings cascade;

drop table if exists public.stripe_price_mappings cascade;
drop table if exists public.plan_limits cascade;

alter table public.user_profiles
  drop column if exists extension_free_plus_expires_at,
  drop column if exists trial_expires_at;
