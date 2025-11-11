-- migrate:up
-- ===========================================
-- 0057_fix_tier_type_cast.sql
-- Fix tier type casting in lexy_upsert_keyword to prevent text-to-smallint errors
-- This migration:
-- 1. Converts the keywords.tier column from text to smallint
-- 2. Drops ALL function overloads and recreates with explicit type casting
-- Tier mapping: 'free'/0=free, 'growth'/1=growth, 'scale'/2=scale
-- ===========================================

-- First, convert the tier column from text to smallint
-- Map: 'free' -> 0, 'growth' -> 1, 'scale' -> 2, anything else -> 0
alter table public.keywords
  alter column tier type smallint
  using (
    case
      when tier = 'growth' or tier = '1' then 1
      when tier = 'scale' or tier = '2' then 2
      else 0  -- 'free', '0', null, or any other value
    end
  );

-- Set default to 0 (free tier)
alter table public.keywords
  alter column tier set default 0;

-- Drop ALL overloads of the function (no parameter list = drops all overloads)
drop function if exists public.lexy_upsert_keyword cascade;

-- Recreate the function with explicit smallint casting
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
  -- Explicitly cast tier to smallint to prevent any type ambiguity
  -- This ensures even if somehow a text value is passed, it will be cast properly
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

-- Grant execute permissions
grant execute on function public.lexy_upsert_keyword to authenticated, service_role, anon;

-- Add helpful comment
comment on function public.lexy_upsert_keyword is 'Upserts keyword with explicit smallint casting for tier to prevent type mismatch errors. Tier mapping: 0=free, 1=growth, 2=scale';

-- migrate:down
drop function if exists public.lexy_upsert_keyword cascade;

-- Revert tier column back to text if needed
alter table public.keywords
  alter column tier type text
  using (
    case
      when tier = 1 then 'growth'
      when tier = 2 then 'scale'
      else 'free'
    end
  );

alter table public.keywords
  alter column tier set default 'free';
