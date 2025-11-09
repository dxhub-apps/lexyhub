-- migrate:up
-- ===========================================
-- 0048_fix_tier_function_signature.sql
-- Ensure lexy_upsert_keyword function accepts smallint for tier parameter
-- This re-applies the fix from migration 0030 to ensure consistency
-- ===========================================

-- Drop and recreate the function with correct smallint parameter
drop function if exists public.lexy_upsert_keyword(text, text, text, text, text, jsonb, numeric, numeric, numeric, numeric, timestamptz);
drop function if exists public.lexy_upsert_keyword(text, text, text, smallint, text, jsonb, numeric, numeric, numeric, numeric, timestamptz);

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
grant execute on function public.lexy_upsert_keyword to authenticated, service_role, anon;

-- migrate:down
-- Restore to text parameter if needed (not recommended)
drop function if exists public.lexy_upsert_keyword(text, text, text, smallint, text, jsonb, numeric, numeric, numeric, numeric, timestamptz);
