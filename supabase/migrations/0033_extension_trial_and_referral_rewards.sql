-- ===========================================
-- 0033_extension_trial_and_referral_rewards.sql
-- Extension 14-day Pro trial + Refer-to-unlock rewards system
-- ===========================================

-- migrate:up

-- 1) Remove old Free+ extension fields and add trial tracking
alter table public.user_profiles
  drop column if exists extension_free_plus_expires_at,
  add column if not exists extension_trial_activated_at timestamptz,
  add column if not exists extension_trial_expires_at timestamptz;

comment on column public.user_profiles.extension_trial_activated_at is 'When user activated 14-day Pro trial via Chrome extension signup.';
comment on column public.user_profiles.extension_trial_expires_at is 'Expiration of 14-day Pro trial from extension signup.';

-- 2) Remove old extension entitlements table (no longer using boost multiplier)
drop table if exists public.plan_entitlements_extension cascade;

-- 3) Create referral rewards tracking table
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  referral_count int not null, -- Number of referrals at time of reward
  reward_tier text not null, -- 'basic' or 'pro'
  reward_duration_months int not null, -- 3 months
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb
);

comment on table public.referral_rewards is 'Tracks refer-to-unlock rewards. 1 referral = 3mo Basic, 3 referrals = 3mo Pro.';

create index if not exists referral_rewards_user_active_idx
  on public.referral_rewards(user_id, is_active, expires_at desc);

-- 4) Create view for active referral rewards per user
create or replace view public.active_referral_rewards as
select
  user_id,
  max(case when reward_tier = 'pro' then reward_tier else 'basic' end) as active_reward_tier,
  max(expires_at) as expires_at,
  count(*) as total_rewards_granted
from public.referral_rewards
where is_active = true
  and expires_at > now()
group by user_id;

comment on view public.active_referral_rewards is 'Shows active referral rewards per user. Pro tier takes precedence over Basic.';

-- 5) Create function to get user's effective plan (considering trials and referral rewards)
create or replace function public.get_effective_plan(p_user_id uuid)
returns table(
  plan_code text,
  plan_source text,  -- 'subscription' | 'extension_trial' | 'referral_reward' | 'trial' | 'base'
  expires_at timestamptz
) as $$
declare
  v_profile record;
  v_subscription record;
  v_referral_reward record;
begin
  -- Get user profile
  select * into v_profile
  from public.user_profiles
  where user_id = p_user_id;

  -- Check for active paid subscription (highest priority)
  select * into v_subscription
  from public.billing_subscriptions
  where user_id = p_user_id
    and status in ('active', 'trialing')
  order by current_period_end desc
  limit 1;

  if found and v_subscription.status = 'active' then
    return query select v_subscription.plan::text, 'subscription'::text, v_subscription.current_period_end;
    return;
  end if;

  -- Check for active extension trial (14-day Pro from extension signup)
  if v_profile.extension_trial_expires_at is not null
     and v_profile.extension_trial_expires_at > now() then
    return query select 'pro'::text, 'extension_trial'::text, v_profile.extension_trial_expires_at;
    return;
  end if;

  -- Check for active referral reward (1 ref = 3mo Basic, 3 refs = 3mo Pro)
  select * into v_referral_reward
  from public.active_referral_rewards
  where user_id = p_user_id
  limit 1;

  if found then
    return query select v_referral_reward.active_reward_tier::text, 'referral_reward'::text, v_referral_reward.expires_at;
    return;
  end if;

  -- Check for regular trial (from trial_expires_at)
  if v_profile.trial_expires_at is not null
     and v_profile.trial_expires_at > now() then
    return query select v_profile.plan::text, 'trial'::text, v_profile.trial_expires_at;
    return;
  end if;

  -- Fallback to base plan
  return query select coalesce(v_profile.plan, 'free')::text, 'base'::text, null::timestamptz;
end;
$$ language plpgsql security definer;

comment on function public.get_effective_plan is 'Returns user''s effective plan considering subscriptions, trials, and referral rewards.';

-- 6) Create function to auto-grant referral rewards based on referral count
create or replace function public.check_and_grant_referral_rewards(p_user_id uuid)
returns table(
  reward_granted boolean,
  reward_tier text,
  message text
) as $$
declare
  v_referral_count int;
  v_existing_basic_reward boolean;
  v_existing_pro_reward boolean;
  v_expires_at timestamptz;
begin
  -- Count successful referrals (users who have signed up and are active)
  select count(distinct ar.referred_user_id) into v_referral_count
  from public.affiliate_referrals ar
  inner join public.user_profiles up on up.user_id = ar.referred_user_id
  where ar.affiliate_id in (
    select id from public.affiliates where user_id = p_user_id
  );

  -- Check if user already has rewards
  select exists(
    select 1 from public.referral_rewards
    where user_id = p_user_id and reward_tier = 'basic' and is_active = true
  ) into v_existing_basic_reward;

  select exists(
    select 1 from public.referral_rewards
    where user_id = p_user_id and reward_tier = 'pro' and is_active = true
  ) into v_existing_pro_reward;

  -- Grant Pro reward if 3+ referrals and not already granted
  if v_referral_count >= 3 and not v_existing_pro_reward then
    v_expires_at := now() + interval '3 months';

    insert into public.referral_rewards (
      user_id,
      referral_count,
      reward_tier,
      reward_duration_months,
      expires_at,
      metadata
    ) values (
      p_user_id,
      v_referral_count,
      'pro',
      3,
      v_expires_at,
      jsonb_build_object('unlocked_at', now(), 'qualifying_referrals', v_referral_count)
    );

    return query select true, 'pro'::text, 'Congratulations! You''ve unlocked Pro for 3 months with 3 referrals.'::text;
    return;
  end if;

  -- Grant Basic reward if 1+ referrals and not already granted
  if v_referral_count >= 1 and not v_existing_basic_reward then
    v_expires_at := now() + interval '3 months';

    insert into public.referral_rewards (
      user_id,
      referral_count,
      reward_tier,
      reward_duration_months,
      expires_at,
      metadata
    ) values (
      p_user_id,
      v_referral_count,
      'basic',
      3,
      v_expires_at,
      jsonb_build_object('unlocked_at', now(), 'qualifying_referrals', v_referral_count)
    );

    return query select true, 'basic'::text, format('Congratulations! You''ve unlocked Basic for 3 months with %s referral(s).', v_referral_count)::text;
    return;
  end if;

  -- No new reward to grant
  return query select false, null::text, format('You have %s referral(s). Need %s for your next reward!', v_referral_count, case when v_referral_count < 1 then 1 else 3 - v_referral_count end)::text;
end;
$$ language plpgsql security definer;

comment on function public.check_and_grant_referral_rewards is 'Checks referral count and auto-grants rewards: 1 ref = 3mo Basic, 3 refs = 3mo Pro.';

-- 7) Update quota RPC to consider effective plan
drop function if exists public.use_quota(uuid, text, int);

create or replace function public.use_quota(
  p_user uuid,
  p_key text,
  p_amount int default 1
)
returns table(allowed boolean, used int, "limit" int) as $$
declare
  period date := date_trunc('month', now())::date;
  ent int;
  cur int;
  effective_plan record;
begin
  -- Get effective plan (considering trials and rewards)
  select * into effective_plan
  from public.get_effective_plan(p_user)
  limit 1;

  -- Get entitlement for effective plan
  select case
    when p_key = 'searches' then searches_per_month
    when p_key = 'ai_opportunities' then ai_opportunities_per_month
    when p_key = 'niches' then niches_max
    else 0
  end into ent
  from public.plan_entitlements
  where plan_code = effective_plan.plan_code;

  if ent is null then
    raise exception 'No entitlement for key "%" on plan "%"', p_key, effective_plan.plan_code;
  end if;

  -- Unlimited plan (-1)
  if ent = -1 then
    insert into public.usage_counters(user_id, period_start, key, value)
      values (p_user, period, p_key, 0)
      on conflict (user_id, period_start, key) do nothing;
    return query select true, 0, -1;
    return;
  end if;

  -- Initialize counter if not exists
  insert into public.usage_counters(user_id, period_start, key, value)
    values (p_user, period, p_key, 0)
    on conflict (user_id, period_start, key) do nothing;

  -- Attempt increment
  update public.usage_counters
  set value = value + p_amount,
      updated_at = now()
  where user_id = p_user
    and period_start = period
    and key = p_key
  returning value into cur;

  -- Check if over limit
  if cur > ent then
    -- Rollback increment
    update public.usage_counters
    set value = value - p_amount,
        updated_at = now()
    where user_id = p_user
      and period_start = period
      and key = p_key;
    return query select false, cur - p_amount, ent;
  else
    return query select true, cur, ent;
  end if;
end;
$$ language plpgsql security definer;

comment on function public.use_quota is 'Quota enforcement using effective plan (includes trials and referral rewards).';

-- Grant permissions
grant execute on function public.get_effective_plan(uuid) to authenticated, service_role;
grant execute on function public.check_and_grant_referral_rewards(uuid) to authenticated, service_role;
grant execute on function public.use_quota(uuid, text, int) to authenticated, service_role;
grant select on public.active_referral_rewards to authenticated, service_role;
grant all on public.referral_rewards to service_role;
grant select, insert on public.referral_rewards to authenticated;

-- migrate:down

drop function if exists public.use_quota(uuid, text, int);
drop function if exists public.check_and_grant_referral_rewards(uuid);
drop function if exists public.get_effective_plan(uuid);
drop view if exists public.active_referral_rewards;
drop index if exists referral_rewards_user_active_idx;
drop table if exists public.referral_rewards cascade;

alter table public.user_profiles
  drop column if exists extension_trial_expires_at,
  drop column if exists extension_trial_activated_at;
