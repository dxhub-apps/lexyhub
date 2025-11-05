-- migrate:up
-- ===========================================
-- 0030_tier_column_to_smallint.sql
-- Convert tier column from text to smallint
-- Mapping: 0=free, 1=growth, 2=scale
-- ===========================================

-- First, update existing text values to numeric equivalents temporarily
update public.keywords
set tier = case
  when tier = 'free' then '0'
  when tier = 'growth' then '1'
  when tier = 'scale' then '2'
  else '0'
end
where tier in ('free', 'growth', 'scale');

-- Alter the column type from text to smallint
alter table public.keywords
alter column tier type smallint using tier::smallint;

-- Set default to 0 (free tier)
alter table public.keywords
alter column tier set default 0;

-- Recreate the lexy_upsert_keyword function with smallint parameter
create or replace function public.lexy_upsert_keyword(
  p_term text,
  p_market text,
  p_source text,
  p_tier smallint default 0,
  p_method text default null,
  p_extras jsonb default '{}'::jsonb,
  p_demand numeric default null,
  p_competition numeric default null,
  p_engagement numeric default null,
  p_ai numeric default null,
  p_freshness timestamptz default now()
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.keywords(term, market, source, tier, method, extras,
    demand_index, competition_score, engagement_score, ai_opportunity_score, freshness_ts)
  values (p_term, p_market, p_source, p_tier, p_method, coalesce(p_extras,'{}'::jsonb),
    public.lexy_clip01(p_demand), public.lexy_clip01(p_competition),
    public.lexy_clip01(p_engagement), public.lexy_clip01(p_ai), p_freshness)
  on conflict (term_normalized, market, source) do update
  set tier = excluded.tier,
      method = coalesce(excluded.method, public.keywords.method),
      extras = coalesce(public.keywords.extras,'{}'::jsonb) || coalesce(excluded.extras,'{}'::jsonb),
      demand_index = coalesce(excluded.demand_index, public.keywords.demand_index),
      competition_score = coalesce(excluded.competition_score, public.keywords.competition_score),
      engagement_score = coalesce(excluded.engagement_score, public.keywords.engagement_score),
      ai_opportunity_score = coalesce(excluded.ai_opportunity_score, public.keywords.ai_opportunity_score),
      freshness_ts = greatest(public.keywords.freshness_ts, excluded.freshness_ts),
      updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

-- Ensure permissions are granted
grant execute on function public.lexy_upsert_keyword to authenticated, service_role;

-- migrate:down
-- Revert tier column back to text
alter table public.keywords
alter column tier type text using
  case
    when tier = 0 then 'free'
    when tier = 1 then 'growth'
    when tier = 2 then 'scale'
    else 'free'
  end;

alter table public.keywords
alter column tier set default 'free';

-- Restore the original function signature
create or replace function public.lexy_upsert_keyword(
  p_term text,
  p_market text,
  p_source text,
  p_tier text default 'free',
  p_method text default null,
  p_extras jsonb default '{}'::jsonb,
  p_demand numeric default null,
  p_competition numeric default null,
  p_engagement numeric default null,
  p_ai numeric default null,
  p_freshness timestamptz default now()
) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.keywords(term, market, source, tier, method, extras,
    demand_index, competition_score, engagement_score, ai_opportunity_score, freshness_ts)
  values (p_term, p_market, p_source, p_tier, p_method, coalesce(p_extras,'{}'::jsonb),
    public.lexy_clip01(p_demand), public.lexy_clip01(p_competition),
    public.lexy_clip01(p_engagement), public.lexy_clip01(p_ai), p_freshness)
  on conflict (term_normalized, market, source) do update
  set tier = excluded.tier,
      method = coalesce(excluded.method, public.keywords.method),
      extras = coalesce(public.keywords.extras,'{}'::jsonb) || coalesce(excluded.extras,'{}'::jsonb),
      demand_index = coalesce(excluded.demand_index, public.keywords.demand_index),
      competition_score = coalesce(excluded.competition_score, public.keywords.competition_score),
      engagement_score = coalesce(excluded.engagement_score, public.keywords.engagement_score),
      ai_opportunity_score = coalesce(excluded.ai_opportunity_score, public.keywords.ai_opportunity_score),
      freshness_ts = greatest(public.keywords.freshness_ts, excluded.freshness_ts),
      updated_at = now()
  returning id into v_id;
  return v_id;
end $$;

grant execute on function public.lexy_upsert_keyword to authenticated, service_role;
