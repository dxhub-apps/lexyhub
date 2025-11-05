-- ===========================================
-- 0024_quota_rpc.sql
-- Server-side quota enforcement function
-- ===========================================

-- migrate:up

-- Atomic quota check and increment
-- Returns: allowed (bool), used (int), limit (int)
-- -1 limit means unlimited
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
  plan text;
begin
  -- Resolve user plan (from active subscription or fallback to user_profiles)
  select coalesce(
    (select bs.plan
     from public.billing_subscriptions bs
     where bs.user_id = p_user
       and bs.status in ('active', 'trialing')
     order by bs.current_period_end desc
     limit 1),
    (select up.plan
     from public.user_profiles up
     where up.user_id = p_user),
    'free'
  ) into plan;

  -- Get entitlement for this plan + key
  select case
    when p_key = 'searches' then searches_per_month
    when p_key = 'ai_opportunities' then ai_opportunities_per_month
    when p_key = 'niches' then niches_max
    else 0
  end into ent
  from public.plan_entitlements
  where plan_code = plan;

  if ent is null then
    raise exception 'No entitlement for key "%" on plan "%"', p_key, plan;
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

comment on function public.use_quota is 'Atomic quota check and increment. Returns (allowed, used, limit). -1 = unlimited.';

-- migrate:down

drop function if exists public.use_quota(uuid, text, int);
