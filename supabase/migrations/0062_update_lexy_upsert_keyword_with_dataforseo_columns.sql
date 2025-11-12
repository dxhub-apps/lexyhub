-- migrate:up
-- ===========================================
-- 0062_update_lexy_upsert_keyword_with_dataforseo_columns.sql
-- Update lexy_upsert_keyword function to populate DataForSEO columns directly
-- Extracts data from extras JSONB and populates dedicated columns
-- ===========================================

-- Drop existing function
drop function if exists public.lexy_upsert_keyword cascade;

-- Recreate with DataForSEO column population
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
declare
  v_id uuid;
  v_tier_value smallint;
  v_search_volume integer;
  v_cpc numeric(10,2);
  v_dataforseo_competition numeric(5,4);
  v_monthly_trend jsonb;
begin
  -- Explicitly cast tier to smallint
  v_tier_value := p_tier::smallint;

  -- Extract DataForSEO metrics from extras if present
  v_search_volume := (p_extras->>'search_volume')::integer;
  v_cpc := (p_extras->>'cpc')::numeric(10,2);
  v_dataforseo_competition := (p_extras->'dataforseo'->>'competition')::numeric(5,4);
  v_monthly_trend := p_extras->'monthly_trend';

  insert into public.keywords(
    term, market, source, tier, method, extras,
    demand_index, competition_score, engagement_score, ai_opportunity_score, freshness_ts,
    search_volume, cpc, dataforseo_competition, monthly_trend
  )
  values (
    p_term, p_market, p_source, v_tier_value, p_method, coalesce(p_extras,'{}'::jsonb),
    public.lexy_clip01(p_demand), public.lexy_clip01(p_competition),
    public.lexy_clip01(p_engagement), public.lexy_clip01(p_ai), p_freshness,
    v_search_volume, v_cpc, v_dataforseo_competition, v_monthly_trend
  )
  on conflict (term_normalized, market, source) do update
  set
    tier = excluded.tier,
    method = coalesce(excluded.method, public.keywords.method),
    extras = coalesce(public.keywords.extras,'{}'::jsonb) || coalesce(excluded.extras,'{}'::jsonb),
    demand_index = coalesce(excluded.demand_index, public.keywords.demand_index),
    competition_score = coalesce(excluded.competition_score, public.keywords.competition_score),
    engagement_score = coalesce(excluded.engagement_score, public.keywords.engagement_score),
    ai_opportunity_score = coalesce(excluded.ai_opportunity_score, public.keywords.ai_opportunity_score),
    freshness_ts = greatest(public.keywords.freshness_ts, excluded.freshness_ts),
    -- Update DataForSEO columns
    search_volume = coalesce(excluded.search_volume, public.keywords.search_volume),
    cpc = coalesce(excluded.cpc, public.keywords.cpc),
    dataforseo_competition = coalesce(excluded.dataforseo_competition, public.keywords.dataforseo_competition),
    monthly_trend = coalesce(excluded.monthly_trend, public.keywords.monthly_trend),
    updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

-- Grant execute permissions
grant execute on function public.lexy_upsert_keyword to authenticated, service_role, anon;

-- Add helpful comment
comment on function public.lexy_upsert_keyword is 'Upserts keyword with DataForSEO metrics extracted from extras JSONB into dedicated columns. Tier mapping: 0=free, 1=growth, 2=scale';

-- migrate:down
drop function if exists public.lexy_upsert_keyword cascade;

-- Restore previous version without DataForSEO column population
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
declare
  v_id uuid;
  v_tier_value smallint;
begin
  v_tier_value := p_tier::smallint;

  insert into public.keywords(term, market, source, tier, method, extras,
    demand_index, competition_score, engagement_score, ai_opportunity_score, freshness_ts)
  values (p_term, p_market, p_source, v_tier_value, p_method, coalesce(p_extras,'{}'::jsonb),
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

grant execute on function public.lexy_upsert_keyword to authenticated, service_role, anon;
