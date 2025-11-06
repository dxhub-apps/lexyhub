-- ===========================================
-- 0034_admin_pricing_metrics_functions.sql
-- RPC functions for admin dashboard pricing metrics
-- ===========================================

-- migrate:up

-- 1) Extension Trial Metrics
create or replace function public.get_extension_trial_metrics()
returns table(
  total_activated bigint,
  currently_active bigint,
  expired bigint,
  never_activated bigint
) as $$
begin
  return query
  select
    count(*) filter (where extension_trial_activated_at is not null) as total_activated,
    count(*) filter (where extension_trial_expires_at is not null and extension_trial_expires_at > now()) as currently_active,
    count(*) filter (where extension_trial_activated_at is not null and extension_trial_expires_at <= now()) as expired,
    count(*) filter (where extension_trial_activated_at is null) as never_activated
  from public.user_profiles;
end;
$$ language plpgsql security definer;

comment on function public.get_extension_trial_metrics is 'Admin dashboard: Get extension trial statistics.';

-- 2) Referral Rewards Metrics
create or replace function public.get_referral_rewards_metrics()
returns table(
  total_basic_rewards bigint,
  total_pro_rewards bigint,
  active_basic_rewards bigint,
  active_pro_rewards bigint,
  total_users_with_referrals bigint
) as $$
begin
  return query
  select
    count(*) filter (where reward_tier = 'basic') as total_basic_rewards,
    count(*) filter (where reward_tier = 'pro') as total_pro_rewards,
    count(*) filter (where reward_tier = 'basic' and is_active and expires_at > now()) as active_basic_rewards,
    count(*) filter (where reward_tier = 'pro' and is_active and expires_at > now()) as active_pro_rewards,
    count(distinct user_id) as total_users_with_referrals
  from public.referral_rewards;
end;
$$ language plpgsql security definer;

comment on function public.get_referral_rewards_metrics is 'Admin dashboard: Get referral rewards statistics.';

-- 3) Aggregate Usage Stats
create or replace function public.get_aggregate_usage_stats()
returns table(
  total_searches_this_month bigint,
  total_ai_ops_this_month bigint,
  total_niches_tracked bigint,
  avg_searches_per_user numeric
) as $$
declare
  period_start date := date_trunc('month', now())::date;
begin
  return query
  select
    coalesce(sum(value) filter (where key = 'searches'), 0) as total_searches_this_month,
    coalesce(sum(value) filter (where key = 'ai_opportunities'), 0) as total_ai_ops_this_month,
    coalesce(sum(value) filter (where key = 'niches'), 0) as total_niches_tracked,
    coalesce(
      avg(value) filter (where key = 'searches'),
      0
    ) as avg_searches_per_user
  from public.usage_counters
  where period_start = get_aggregate_usage_stats.period_start;
end;
$$ language plpgsql security definer;

comment on function public.get_aggregate_usage_stats is 'Admin dashboard: Get aggregate usage statistics for current month.';

-- 4) Pricing Conversion Funnel
create or replace function public.get_pricing_conversion_funnel()
returns table(
  page_views bigint,
  checkout_started bigint,
  checkout_completed bigint,
  conversion_rate numeric
) as $$
declare
  thirty_days_ago timestamptz := now() - interval '30 days';
begin
  return query
  select
    count(*) filter (where event_type = 'page_view') as page_views,
    count(*) filter (where event_type = 'checkout_started') as checkout_started,
    count(*) filter (where event_type = 'checkout_completed') as checkout_completed,
    case
      when count(*) filter (where event_type = 'checkout_started') > 0
      then round(
        (count(*) filter (where event_type = 'checkout_completed')::numeric /
         count(*) filter (where event_type = 'checkout_started')::numeric) * 100,
        1
      )
      else 0
    end as conversion_rate
  from public.pricing_analytics
  where created_at >= thirty_days_ago;
end;
$$ language plpgsql security definer;

comment on function public.get_pricing_conversion_funnel is 'Admin dashboard: Get pricing page conversion funnel for last 30 days.';

-- Grant permissions to service_role (admin access)
grant execute on function public.get_extension_trial_metrics() to service_role;
grant execute on function public.get_referral_rewards_metrics() to service_role;
grant execute on function public.get_aggregate_usage_stats() to service_role;
grant execute on function public.get_pricing_conversion_funnel() to service_role;

-- migrate:down

drop function if exists public.get_pricing_conversion_funnel();
drop function if exists public.get_aggregate_usage_stats();
drop function if exists public.get_referral_rewards_metrics();
drop function if exists public.get_extension_trial_metrics();
