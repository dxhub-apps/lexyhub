-- ===========================================
-- 0033_update_quota_limits.sql
-- Update plan limits to align with new quota strategy
-- ===========================================

-- migrate:up

-- 1) Add new columns to plan_entitlements for LexyBrain-specific quotas
alter table public.plan_entitlements
  add column if not exists ai_calls_per_month int not null default -1,
  add column if not exists briefs_per_month int not null default -1,
  add column if not exists sims_per_month int not null default -1,
  add column if not exists rag_messages_per_month int not null default -1;

comment on column public.plan_entitlements.ai_calls_per_month is 'LexyBrain AI calls (market_brief, radar, ad_insight, risk) per month. -1 = unlimited.';
comment on column public.plan_entitlements.briefs_per_month is 'Multi-keyword brief generations per month. -1 = unlimited.';
comment on column public.plan_entitlements.sims_per_month is 'Market Twin simulator calls per month. -1 = unlimited.';
comment on column public.plan_entitlements.rag_messages_per_month is 'Ask LexyBrain RAG messages per month. -1 = unlimited.';

-- 2) Add free_extension plan (Free+ tier for Chrome extension users)
insert into public.plan_entitlements (
  plan_code,
  searches_per_month,
  niches_max,
  ai_opportunities_per_month,
  ai_calls_per_month,
  briefs_per_month,
  sims_per_month,
  rag_messages_per_month
) values (
  'free_extension',
  200,  -- KS: keyword searches
  30,   -- WL: watchlist keywords
  200,  -- legacy ai_opportunities
  80,   -- LB: LexyBrain/RAG calls (mapped to ai_calls for compatibility)
  1,    -- BR: briefs
  10,   -- simulator calls
  80    -- LB: LexyBrain RAG messages
)
on conflict (plan_code) do update set
  searches_per_month = excluded.searches_per_month,
  niches_max = excluded.niches_max,
  ai_opportunities_per_month = excluded.ai_opportunities_per_month,
  ai_calls_per_month = excluded.ai_calls_per_month,
  briefs_per_month = excluded.briefs_per_month,
  sims_per_month = excluded.sims_per_month,
  rag_messages_per_month = excluded.rag_messages_per_month,
  updated_at = now();

-- 3) Update existing plans with new limits
-- Free tier
update public.plan_entitlements
set searches_per_month = 50,         -- KS
    niches_max = 10,                  -- WL
    ai_opportunities_per_month = 50,  -- legacy
    ai_calls_per_month = 20,          -- LB (ai_calls component)
    briefs_per_month = 0,             -- BR
    sims_per_month = 2,
    rag_messages_per_month = 20,      -- LB (RAG messages)
    updated_at = now()
where plan_code = 'free';

-- Basic tier ($6.99/mo)
update public.plan_entitlements
set searches_per_month = 1000,       -- KS
    niches_max = 150,                 -- WL
    ai_opportunities_per_month = 1000, -- legacy
    ai_calls_per_month = 300,         -- LB
    briefs_per_month = 4,             -- BR
    sims_per_month = 50,
    rag_messages_per_month = 300,     -- LB
    updated_at = now()
where plan_code = 'basic';

-- Basic tier alias (spark → basic)
update public.plan_entitlements
set searches_per_month = 1000,
    niches_max = 150,
    ai_opportunities_per_month = 1000,
    ai_calls_per_month = 300,
    briefs_per_month = 4,
    sims_per_month = 50,
    rag_messages_per_month = 300,
    updated_at = now()
where plan_code = 'spark';

-- Pro tier ($12.99/mo)
update public.plan_entitlements
set searches_per_month = 10000,      -- KS
    niches_max = 1000,                -- WL
    ai_opportunities_per_month = 10000, -- legacy
    ai_calls_per_month = 1000,        -- LB
    briefs_per_month = 12,            -- BR
    sims_per_month = 200,
    rag_messages_per_month = 1000,    -- LB
    updated_at = now()
where plan_code = 'pro';

-- Growth tier ($55/mo) - note: price updated from $24.99 to $55
update public.plan_entitlements
set searches_per_month = 50000,      -- KS
    niches_max = 5000,                -- WL
    ai_opportunities_per_month = 50000, -- legacy
    ai_calls_per_month = 5000,        -- LB
    briefs_per_month = 30,            -- BR
    sims_per_month = -1,              -- unlimited
    rag_messages_per_month = 5000,    -- LB
    updated_at = now()
where plan_code = 'growth';

-- Legacy scale/apex remain unlimited
update public.plan_entitlements
set searches_per_month = -1,
    niches_max = -1,
    ai_opportunities_per_month = -1,
    ai_calls_per_month = -1,
    briefs_per_month = -1,
    sims_per_month = -1,
    rag_messages_per_month = -1,
    updated_at = now()
where plan_code in ('scale', 'apex');

-- 4) Update plan_limits pricing and display info
-- Add free_extension to plan_limits
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
) values (
  'free_extension',
  'Free+',
  0,
  0,
  200,
  30,
  200,
  300,
  '["200 monthly searches", "30 watchlist keywords", "80 LexyBrain calls", "1 brief per month", "Extension boost"]'::jsonb,
  false,
  2  -- Between free (1) and basic (2), so shift basic to 3
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

-- Update free tier in plan_limits
update public.plan_limits
set searches_per_month = 50,
    niches_max = 10,
    ai_opportunities_per_month = 50,
    keywords_storage_max = 100,
    features = '["50 monthly searches", "10 watchlist keywords", "20 LexyBrain calls", "Basic insights", "Extension support"]'::jsonb,
    updated_at = now()
where plan_code = 'free';

-- Update basic tier in plan_limits (sort_order 3 now)
update public.plan_limits
set searches_per_month = 1000,
    niches_max = 150,
    ai_opportunities_per_month = 1000,
    keywords_storage_max = 1500,
    features = '["1,000 monthly searches", "150 watchlist keywords", "300 LexyBrain calls", "4 briefs per month", "Advanced insights", "Email support"]'::jsonb,
    sort_order = 3,
    updated_at = now()
where plan_code = 'basic';

-- Update pro tier in plan_limits (sort_order 4 now)
update public.plan_limits
set searches_per_month = 10000,
    niches_max = 1000,
    ai_opportunities_per_month = 10000,
    keywords_storage_max = 10000,
    features = '["10,000 monthly searches", "1,000 watchlist keywords", "1,000 LexyBrain calls", "12 briefs per month", "Market Twin simulator", "Priority support", "Advanced analytics"]'::jsonb,
    sort_order = 4,
    updated_at = now()
where plan_code = 'pro';

-- Update growth tier in plan_limits (sort_order 5, price $55)
update public.plan_limits
set price_monthly_cents = 5500,        -- $55/mo
    price_annual_cents = 55000,        -- $550/yr (~17% savings)
    searches_per_month = 50000,
    niches_max = 5000,
    ai_opportunities_per_month = 50000,
    keywords_storage_max = 50000,
    features = '["50,000 monthly searches", "5,000 watchlist keywords", "5,000 LexyBrain calls", "30 briefs per month", "Unlimited simulators", "White-glove support", "API access", "Team collaboration"]'::jsonb,
    is_hidden = false,                 -- Make visible now
    sort_order = 5,
    updated_at = now()
where plan_code = 'growth';

-- 5) Update use_quota RPC to support new quota keys
-- Add support for "ks" (keyword searches), "lb" (LexyBrain), "br" (briefs), "wl" (watchlist)
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

  -- Map quota key to entitlement field
  select case
    when p_key = 'searches' or p_key = 'ks' then searches_per_month
    when p_key = 'ai_opportunities' then ai_opportunities_per_month
    when p_key = 'niches' or p_key = 'wl' then niches_max
    when p_key = 'lb' or p_key = 'rag_messages' then rag_messages_per_month
    when p_key = 'br' or p_key = 'briefs' then briefs_per_month
    when p_key = 'ai_calls' then ai_calls_per_month
    when p_key = 'ai_sim' or p_key = 'sims' then sims_per_month
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

comment on function public.use_quota is 'Atomic quota check and increment. Supports keys: searches/ks, ai_opportunities, niches/wl, lb/rag_messages, br/briefs, ai_calls, ai_sim/sims. -1 = unlimited.';

-- migrate:down

-- Revert use_quota function
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

  if ent = -1 then
    insert into public.usage_counters(user_id, period_start, key, value)
      values (p_user, period, p_key, 0)
      on conflict (user_id, period_start, key) do nothing;
    return query select true, 0, -1;
    return;
  end if;

  insert into public.usage_counters(user_id, period_start, key, value)
    values (p_user, period, p_key, 0)
    on conflict (user_id, period_start, key) do nothing;

  update public.usage_counters
  set value = value + p_amount,
      updated_at = now()
  where user_id = p_user
    and period_start = period
    and key = p_key
  returning value into cur;

  if cur > ent then
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

-- Remove new columns from plan_entitlements
alter table public.plan_entitlements
  drop column if exists rag_messages_per_month,
  drop column if exists sims_per_month,
  drop column if exists briefs_per_month,
  drop column if exists ai_calls_per_month;

-- Remove free_extension plan
delete from public.plan_limits where plan_code = 'free_extension';
delete from public.plan_entitlements where plan_code = 'free_extension';
