-- migrate:up
-- =============================================================
-- 0069_recreate_rank_keyword_embedding_join.sql
-- Force the optimized keyword ranking RPC to hydrate embeddings
-- from the shared cache and ensure all helper casting functions
-- exist so search never references the removed keywords.embedding
-- column again.
-- =============================================================

set search_path = public;

create or replace function public.lexy_cast_sources(p_sources text[])
returns text[]
language sql
immutable
as $$
  select case when count(*) = 0 then null else array_agg(src order by src) end
  from (
    select distinct lower(btrim(s)) as src
    from unnest(coalesce(p_sources, array[]::text[])) as u(s)
    where s is not null and btrim(s) <> ''
  ) as dedup;
$$;

grant execute on function public.lexy_cast_sources(text[]) to anon, authenticated, service_role;

create or replace function public.lexy_cast_plan_tiers(p_tiers smallint[])
returns smallint[]
language sql
immutable
as $$
  with normalized as (
    select distinct greatest(0, least(2, coalesce(tier, 0)))::smallint as tier
    from unnest(coalesce(p_tiers, array[0,1,2]::smallint[])) as t(tier)
  )
  select case when count(*) = 0 then array[0,1,2]::smallint[] else array_agg(tier order by tier) end
  from normalized;
$$;

grant execute on function public.lexy_cast_plan_tiers(smallint[]) to anon, authenticated, service_role;

drop function if exists public.lexy_rank_keywords;

create or replace function public.lexy_rank_keywords(
  p_query_embedding vector(3072),
  p_market text,
  p_sources text[],
  p_tiers smallint[],
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  term text,
  market text,
  source text,
  tier text,
  demand_index numeric,
  competition_score numeric,
  trend_momentum numeric,
  ai_opportunity_score numeric,
  engagement_score numeric,
  extras jsonb,
  search_volume numeric,
  cpc numeric,
  monthly_trend jsonb,
  dataforseo_competition numeric,
  freshness_ts timestamptz,
  similarity double precision,
  composite_score double precision,
  ranking_score double precision
)
language plpgsql
stable
as $$
declare
  v_query_trim text := btrim(coalesce(p_query, ''));
  v_query_lower text := lower(v_query_trim);
  v_market text := lower(btrim(coalesce(p_market, 'us')));
  v_sources text[] := public.lexy_cast_sources(p_sources);
  v_tier_filters smallint[] := public.lexy_cast_plan_tiers(p_tiers);
  v_limit integer := greatest(1, coalesce(p_limit, 20));
begin
  if v_market = '' then
    v_market := 'us';
  end if;

  return query
  with candidates as (
    select
      k.id,
      k.term,
      k.market,
      k.source,
      k.tier,
      k.demand_index,
      k.competition_score,
      k.trend_momentum,
      k.ai_opportunity_score,
      k.engagement_score,
      k.extras,
      k.search_volume,
      k.cpc,
      k.monthly_trend,
      k.dataforseo_competition,
      k.freshness_ts,
      coalesce(nullif(k.term_normalized, ''), lower(btrim(k.term))) as normalized_term,
      case when lower(k.term) = v_query_lower then true else false end as is_exact
    from public.keywords k
    where k.market = v_market
      and (v_sources is null or k.source = any(v_sources))
      and (v_tier_filters is null or k.tier = any(v_tier_filters))
      and k.term is not null
      and k.term <> ''
      and (v_query_trim = '' or k.term ilike '%' || v_query_trim || '%')
    limit greatest(v_limit * 6, 150)
  ),
  hydrated as (
    select
      c.*,
      emb.embedding
    from candidates c
    left join lateral (
      select e.embedding
      from public.embeddings e
      where e.term = c.normalized_term
      order by e.created_at desc
      limit 1
    ) emb on true
  ),
  ranked as (
    select
      h.*,
      case
        when h.embedding is not null and p_query_embedding is not null then
          1 - (h.embedding <=> p_query_embedding)
        else 0.5
      end as sim,
      (
        0.4 * coalesce(least(h.demand_index, 1), 0.55) +
        0.3 * (1 - coalesce(least(h.competition_score, 1), 0.45)) +
        0.3 * coalesce(least(h.trend_momentum, 1), 0.5)
      ) as comp_score
    from hydrated h
  )
  select
    r.id,
    r.term,
    r.market,
    r.source,
    r.tier,
    r.demand_index,
    r.competition_score,
    r.trend_momentum,
    r.ai_opportunity_score,
    r.engagement_score,
    r.extras,
    r.search_volume,
    r.cpc,
    r.monthly_trend,
    r.dataforseo_competition,
    r.freshness_ts,
    r.sim::double precision as similarity,
    r.comp_score::double precision as composite_score,
    case
      when r.is_exact then 999999999.0
      else (r.sim * 0.55 + r.comp_score * 0.45)
    end::double precision as ranking_score
  from ranked r
  order by ranking_score desc
  limit v_limit;
end;
$$;

grant execute on function public.lexy_rank_keywords to authenticated, anon;
comment on function public.lexy_rank_keywords is 'Optimized keyword ranking that hydrates embeddings from the cache table.';

-- Verify helper availability so migrations fail fast if something is missing
DO $$
BEGIN
  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'lexy_cast_sources';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lexy_cast_sources helper is missing';
  END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'lexy_cast_plan_tiers';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lexy_cast_plan_tiers helper is missing';
  END IF;

  PERFORM 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'lexy_rank_keywords';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lexy_rank_keywords RPC failed to create';
  END IF;
END
$$;

-- migrate:down
drop function if exists public.lexy_rank_keywords;

create or replace function public.lexy_rank_keywords(
  p_query_embedding vector(3072),
  p_market text,
  p_sources text[],
  p_tiers smallint[],
  p_query text,
  p_limit integer default 20
)
returns table (
  id uuid,
  term text,
  market text,
  source text,
  tier text,
  demand_index numeric,
  competition_score numeric,
  trend_momentum numeric,
  ai_opportunity_score numeric,
  engagement_score numeric,
  extras jsonb,
  search_volume numeric,
  cpc numeric,
  monthly_trend jsonb,
  dataforseo_competition numeric,
  freshness_ts timestamptz,
  similarity double precision,
  composite_score double precision,
  ranking_score double precision
)
language plpgsql
stable
as $$
declare
  v_query_trim text := btrim(coalesce(p_query, ''));
  v_query_lower text := lower(v_query_trim);
  v_market text := lower(btrim(coalesce(p_market, 'us')));
  v_sources text[] := public.lexy_cast_sources(p_sources);
  v_tier_filters smallint[] := public.lexy_cast_plan_tiers(p_tiers);
begin
  if v_market = '' then
    v_market := 'us';
  end if;

  return query
  with candidates as (
    select
      k.id,
      k.term,
      k.market,
      k.source,
      k.tier,
      k.demand_index,
      k.competition_score,
      k.trend_momentum,
      k.ai_opportunity_score,
      k.engagement_score,
      k.extras,
      k.search_volume,
      k.cpc,
      k.monthly_trend,
      k.dataforseo_competition,
      k.freshness_ts,
      k.embedding,
      case when lower(k.term) = v_query_lower then true else false end as is_exact
    from public.keywords k
    where k.market = v_market
      and (v_sources is null or k.source = any(v_sources))
      and (v_tier_filters is null or k.tier = any(v_tier_filters))
      and k.term is not null
      and k.term <> ''
      and (v_query_trim = '' or k.term ilike '%' || v_query_trim || '%')
    limit greatest(p_limit * 6, 150)
  ),
  ranked as (
    select
      c.*,
      case
        when c.embedding is not null and p_query_embedding is not null then 1 - (c.embedding <=> p_query_embedding)
        else 0.5
      end as sim,
      (
        0.4 * coalesce(least(c.demand_index, 1), 0.55) +
        0.3 * (1 - coalesce(least(c.competition_score, 1), 0.45)) +
        0.3 * coalesce(least(c.trend_momentum, 1), 0.5)
      ) as comp_score
    from candidates c
  )
  select
    r.id,
    r.term,
    r.market,
    r.source,
    r.tier,
    r.demand_index,
    r.competition_score,
    r.trend_momentum,
    r.ai_opportunity_score,
    r.engagement_score,
    r.extras,
    r.search_volume,
    r.cpc,
    r.monthly_trend,
    r.dataforseo_competition,
    r.freshness_ts,
    r.sim::double precision as similarity,
    r.comp_score::double precision as composite_score,
    case
      when r.is_exact then 999999999.0
      else (r.sim * 0.55 + r.comp_score * 0.45)
    end::double precision as ranking_score
  from ranked r
  order by ranking_score desc
  limit p_limit;
end;
$$;

grant execute on function public.lexy_rank_keywords to authenticated, anon;
comment on function public.lexy_rank_keywords is 'Optimized keyword ranking with normalized tiers and sources.';

create or replace function public.lexy_cast_sources(p_sources text[])
returns text[]
language sql
immutable
as $$
  select array_agg(src)
  from (
    select distinct lower(btrim(s)) as src
    from unnest(coalesce(p_sources, array[]::text[])) as u(s)
    where s is not null and btrim(s) <> ''
  ) as dedup;
$$;

grant execute on function public.lexy_cast_sources(text[]) to anon, authenticated, service_role;

create or replace function public.lexy_cast_plan_tiers(p_tiers smallint[])
returns smallint[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct greatest(0, least(2, tier))::smallint), array[0,1,2]::smallint[])
  from unnest(coalesce(p_tiers, array[0,1,2]::smallint[])) as t(tier);
$$;

grant execute on function public.lexy_cast_plan_tiers(smallint[]) to anon, authenticated, service_role;
