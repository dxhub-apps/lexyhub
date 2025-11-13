-- migrate:up
-- ===========================================
-- 0064_fix_keyword_search_functions.sql
-- Harden keyword normalization/upserts and make tier filters compatible with smallint column
-- ===========================================

-- Refresh normalization helper to collapse whitespace and guard against blanks
create or replace function public.lexy_normalize_keyword(p text)
returns text
language sql
immutable
parallel safe
as $$
  select nullif(regexp_replace(lower(trim(coalesce(p, ''))), '\\s+', ' ', 'g'), '')
$$;

-- Recreate the before-insert/update trigger to enforce normalization consistently
drop trigger if exists trg_keywords_bu on public.keywords;
drop function if exists public.lexy_keywords_bu;
create or replace function public.lexy_keywords_bu()
returns trigger
language plpgsql
as $$
begin
  if new.term is null or btrim(new.term) = '' then
    raise exception 'keyword term cannot be blank' using errcode = '23514';
  end if;

  new.term := btrim(new.term);
  new.term_normalized := public.lexy_normalize_keyword(new.term);

  if new.market is not null then
    new.market := lower(btrim(new.market));
  end if;

  if new.source is not null then
    new.source := lower(btrim(new.source));
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_keywords_bu
before insert or update on public.keywords
for each row execute function public.lexy_keywords_bu();

-- Exact match helper now reuses hardened normalization
create or replace function public.lexy_lower_eq_keyword(p_market text, p_term text)
returns public.keywords
language sql
stable
as $$
  select k.*
  from public.keywords k
  where k.market = lower(trim(coalesce(p_market, '')))
    and k.term_normalized = public.lexy_normalize_keyword(p_term)
  limit 1
$$;

grant execute on function public.lexy_lower_eq_keyword(text, text) to anon, authenticated, service_role;

-- Upsert function now normalizes market/source/term before inserting
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
language plpgsql
as $$
declare
  v_id uuid;
  v_tier_value smallint;
  v_term text;
  v_term_normalized text;
  v_market text;
  v_source text;
  v_extras jsonb := coalesce(p_extras, '{}'::jsonb);
  v_search_volume integer;
  v_cpc numeric(10,2);
  v_dataforseo_competition numeric(5,4);
  v_monthly_trend jsonb;
begin
  v_term := btrim(coalesce(p_term, ''));
  if v_term = '' then
    raise exception 'keyword term cannot be blank' using errcode = '23514';
  end if;

  v_term_normalized := public.lexy_normalize_keyword(v_term);
  v_market := lower(btrim(coalesce(p_market, 'us')));
  if v_market = '' then
    v_market := 'us';
  end if;

  v_source := lower(btrim(coalesce(p_source, 'synthetic')));
  if v_source = '' then
    v_source := 'synthetic';
  end if;

  v_tier_value := coalesce(p_tier, 0)::smallint;

  v_search_volume := (v_extras->>'search_volume')::integer;
  v_cpc := (v_extras->>'cpc')::numeric(10,2);
  v_dataforseo_competition := (v_extras->'dataforseo'->>'competition')::numeric(5,4);
  v_monthly_trend := v_extras->'monthly_trend';

  insert into public.keywords(
    term,
    term_normalized,
    market,
    source,
    tier,
    method,
    extras,
    demand_index,
    competition_score,
    engagement_score,
    ai_opportunity_score,
    freshness_ts,
    search_volume,
    cpc,
    dataforseo_competition,
    monthly_trend
  )
  values (
    v_term,
    v_term_normalized,
    v_market,
    v_source,
    v_tier_value,
    p_method,
    v_extras,
    public.lexy_clip01(p_demand),
    public.lexy_clip01(p_competition),
    public.lexy_clip01(p_engagement),
    public.lexy_clip01(p_ai),
    p_freshness,
    v_search_volume,
    v_cpc,
    v_dataforseo_competition,
    v_monthly_trend
  )
  on conflict (term_normalized, market, source) do update
  set term = excluded.term,
      term_normalized = excluded.term_normalized,
      market = excluded.market,
      source = excluded.source,
      tier = excluded.tier,
      method = coalesce(excluded.method, public.keywords.method),
      extras = coalesce(public.keywords.extras,'{}'::jsonb) || coalesce(excluded.extras,'{}'::jsonb),
      demand_index = coalesce(excluded.demand_index, public.keywords.demand_index),
      competition_score = coalesce(excluded.competition_score, public.keywords.competition_score),
      engagement_score = coalesce(excluded.engagement_score, public.keywords.engagement_score),
      ai_opportunity_score = coalesce(excluded.ai_opportunity_score, public.keywords.ai_opportunity_score),
      freshness_ts = greatest(public.keywords.freshness_ts, excluded.freshness_ts),
      search_volume = coalesce(excluded.search_volume, public.keywords.search_volume),
      cpc = coalesce(excluded.cpc, public.keywords.cpc),
      dataforseo_competition = coalesce(excluded.dataforseo_competition, public.keywords.dataforseo_competition),
      monthly_trend = coalesce(excluded.monthly_trend, public.keywords.monthly_trend),
      updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.lexy_upsert_keyword to authenticated, service_role, anon;

comment on function public.lexy_upsert_keyword is 'Upserts keyword after normalizing market/source/term while extracting DataForSEO metrics.';

-- Recreate ranking RPC with explicit tier casting support
create or replace function public.lexy_cast_plan_tiers(p_tiers smallint[])
returns smallint[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct greatest(0, least(2, tier))::smallint), array[0,1,2]::smallint[])
  from unnest(coalesce(p_tiers, array[0,1,2]::smallint[])) as t(tier)
$$;

grant execute on function public.lexy_cast_plan_tiers(smallint[]) to anon, authenticated, service_role;

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
  ) as dedup
$$;

grant execute on function public.lexy_cast_sources(text[]) to anon, authenticated, service_role;

create or replace function public.lexy_rank_keywords(
  p_query_embedding vector(3072),
  p_market text,
  p_sources text[],
  p_tiers smallint[],
  p_query text,
  p_limit integer DEFAULT 20
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

-- migrate:down
-- Revert changes if needed
drop trigger if exists trg_keywords_bu on public.keywords;
drop function if exists public.lexy_keywords_bu;
drop function if exists public.lexy_lower_eq_keyword;
drop function if exists public.lexy_upsert_keyword;
drop function if exists public.lexy_cast_plan_tiers;
drop function if exists public.lexy_cast_sources;
drop function if exists public.lexy_rank_keywords;
drop function if exists public.lexy_normalize_keyword;

create or replace function public.lexy_normalize_keyword(p text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(lower(trim(p)), '\\s+', ' ', 'g')
$$;

create or replace function public.lexy_keywords_bu()
returns trigger language plpgsql as $$
begin
  new.term_normalized := public.lexy_normalize_keyword(new.term);
  new.updated_at := now();
  return new;
end
$$;

create trigger trg_keywords_bu before insert or update on public.keywords
for each row execute function public.lexy_keywords_bu();

create or replace function public.lexy_lower_eq_keyword(p_market text, p_term text)
returns public.keywords
language sql stable as $$
  select k.* from public.keywords k
  where k.market = p_market
    and k.term_normalized = public.lexy_normalize_keyword(p_term)
  limit 1
$$;

grant execute on function public.lexy_lower_eq_keyword(text, text) to anon, authenticated, service_role;

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
  v_tier_value := p_tier::smallint;
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
  set tier = excluded.tier,
      method = coalesce(excluded.method, public.keywords.method),
      extras = coalesce(public.keywords.extras,'{}'::jsonb) || coalesce(excluded.extras,'{}'::jsonb),
      demand_index = coalesce(excluded.demand_index, public.keywords.demand_index),
      competition_score = coalesce(excluded.competition_score, public.keywords.competition_score),
      engagement_score = coalesce(excluded.engagement_score, public.keywords.engagement_score),
      ai_opportunity_score = coalesce(excluded.ai_opportunity_score, public.keywords.ai_opportunity_score),
      freshness_ts = greatest(public.keywords.freshness_ts, excluded.freshness_ts),
      search_volume = coalesce(excluded.search_volume, public.keywords.search_volume),
      cpc = coalesce(excluded.cpc, public.keywords.cpc),
      dataforseo_competition = coalesce(excluded.dataforseo_competition, public.keywords.dataforseo_competition),
      monthly_trend = coalesce(excluded.monthly_trend, public.keywords.monthly_trend),
      updated_at = now()
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.lexy_upsert_keyword to authenticated, service_role, anon;
comment on function public.lexy_upsert_keyword is 'Upserts keyword with DataForSEO metrics extracted from extras JSONB into dedicated columns. Tier mapping: 0=free, 1=growth, 2=scale';

create or replace function public.lexy_rank_keywords(
  p_query_embedding vector(3072),
  p_market text,
  p_sources text[],
  p_tiers text[],
  p_query text,
  p_limit integer DEFAULT 20
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
  v_query_lower text;
begin
  v_query_lower := lower(trim(p_query));

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
    where
      k.market = p_market
      and k.source = any(p_sources)
      and k.tier = any(p_tiers)
      and k.term is not null
      and k.term <> ''
      and k.term ilike '%' || p_query || '%'
    limit greatest(p_limit * 6, 150)
  ),
  ranked as (
    select
      c.*,
      case
        when c.embedding is not null and p_query_embedding is not null then
          1 - (c.embedding <=> p_query_embedding)
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
comment on function public.lexy_rank_keywords is 'Optimized keyword ranking with pre-computed embeddings to avoid N+1 API calls';
