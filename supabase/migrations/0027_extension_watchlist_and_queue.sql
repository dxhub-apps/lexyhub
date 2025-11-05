-- ===========================================
-- 0027_extension_watchlist_and_queue.sql
-- Extension-specific watchlist and golden-source upsert queue
-- ===========================================

-- migrate:up

-- 1) Extension watchlist terms (lightweight, term-based, not keyword_id FK)
create table if not exists public.user_watchlist_terms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  term text not null,
  market text not null,  -- 'etsy' | 'amazon' | 'shopify' | 'google' | 'pinterest' | 'reddit'
  normalized_term text generated always as (
    regexp_replace(lower(trim(term)), '\s+', ' ', 'g')
  ) stored,
  source_url text,  -- where the term was captured
  created_at timestamptz not null default now(),
  unique(user_id, market, normalized_term)
);

comment on table public.user_watchlist_terms is 'Extension watchlist: raw terms added via browser extension, not tied to keyword_id.';

create index if not exists user_watchlist_terms_user_market_idx
  on public.user_watchlist_terms(user_id, market, created_at desc);

-- 2) Upsert queue for golden source (public.keywords)
create table if not exists public.ext_watchlist_upsert_queue (
  id bigserial primary key,
  user_id uuid not null,
  market text not null,
  term text not null,
  normalized_term text generated always as (
    regexp_replace(lower(trim(term)), '\s+', ' ', 'g')
  ) stored,
  source_url text,
  enqueued_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

comment on table public.ext_watchlist_upsert_queue is 'Queue for upserting extension watchlist terms into public.keywords (golden source).';

create index if not exists ext_watchlist_upsert_queue_idx
  on public.ext_watchlist_upsert_queue(processed_at nulls first, enqueued_at);

-- 3) Extension boost entitlements for free plan
create table if not exists public.plan_entitlements_extension (
  plan_code text primary key,
  searches_per_month int not null,
  niches_max int not null,
  ai_opportunities_per_month int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.plan_entitlements_extension is 'Boosted quota limits for users with extension installed (applies to free plan only in v1).';

-- Seed boosted free plan entitlements (25 searches vs 10, 3 niches vs 1, 8 AI vs 2)
insert into public.plan_entitlements_extension (plan_code, searches_per_month, niches_max, ai_opportunities_per_month) values
  ('free', 25, 3, 8)
on conflict (plan_code) do update set
  searches_per_month = excluded.searches_per_month,
  niches_max = excluded.niches_max,
  ai_opportunities_per_month = excluded.ai_opportunities_per_month,
  updated_at = now();

-- 4) Extension-aware quota function
create or replace function public.use_quota_ext(
  p_user uuid,
  p_key text,
  p_amount int default 1,
  p_is_extension boolean default false
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

  -- Get entitlement: if extension boost applies (free plan + extension flag), use boosted table
  if p_is_extension and plan = 'free' then
    select case
      when p_key = 'searches' then searches_per_month
      when p_key = 'ai_opportunities' then ai_opportunities_per_month
      when p_key = 'niches' then niches_max
      else 0
    end into ent
    from public.plan_entitlements_extension
    where plan_code = 'free';
  else
    select case
      when p_key = 'searches' then searches_per_month
      when p_key = 'ai_opportunities' then ai_opportunities_per_month
      when p_key = 'niches' then niches_max
      else 0
    end into ent
    from public.plan_entitlements
    where plan_code = plan;
  end if;

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

comment on function public.use_quota_ext is 'Extension-aware quota check. If p_is_extension=true and plan=free, applies boosted entitlements.';

-- Grant permissions
grant execute on function public.use_quota_ext(uuid, text, int, boolean) to authenticated, service_role;

-- migrate:down

drop function if exists public.use_quota_ext(uuid, text, int, boolean);
drop table if exists public.plan_entitlements_extension cascade;
drop index if exists ext_watchlist_upsert_queue_idx;
drop table if exists public.ext_watchlist_upsert_queue cascade;
drop index if exists user_watchlist_terms_user_market_idx;
drop table if exists public.user_watchlist_terms cascade;
