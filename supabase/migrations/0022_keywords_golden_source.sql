-- migrate:up
-- ===========================================
-- 0022_keywords_golden_source.sql
-- Harden public.keywords as the golden source
-- ===========================================

-- Add missing columns to public.keywords
alter table public.keywords
  add column if not exists term_normalized text,
  add column if not exists ingest_source text,
  add column if not exists ingest_source_key text,
  add column if not exists ingest_batch_id uuid;

-- Create normalization function
create or replace function public.lexy_normalize_keyword(p text)
returns text language sql immutable parallel safe as $$
  select regexp_replace(lower(trim(p)), '\s+', ' ', 'g')
$$;

-- Create or replace trigger function to auto-normalize
create or replace function public.lexy_keywords_bu()
returns trigger language plpgsql as $$
begin
  new.term_normalized := public.lexy_normalize_keyword(new.term);
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists trg_keywords_bu on public.keywords;
create trigger trg_keywords_bu before insert or update on public.keywords
for each row execute function public.lexy_keywords_bu();

-- Backfill term_normalized for existing rows
update public.keywords
set term_normalized = public.lexy_normalize_keyword(term)
where term_normalized is null;

-- Drop old unique constraint and create new one with term_normalized
alter table public.keywords
  drop constraint if exists keywords_term_source_unique;

create unique index if not exists keywords_unique_key
  on public.keywords(term_normalized, market, source);

-- Create indexes for query performance
create index if not exists keywords_market_source_ts_idx
  on public.keywords(market, source, freshness_ts desc);

create index if not exists keywords_term_normalized_idx
  on public.keywords(term_normalized);

-- Create exact-match RPC
create or replace function public.lexy_lower_eq_keyword(p_market text, p_term text)
returns public.keywords
language sql stable as $$
  select k.* from public.keywords k
  where k.market = p_market
    and k.term_normalized = public.lexy_normalize_keyword(p_term)
  limit 1
$$;

-- Create clip function for normalizing metrics to [0,1]
create or replace function public.lexy_clip01(n numeric)
returns numeric language sql immutable as $$
  select greatest(0, least(1, coalesce(n,0)))
$$;

-- Create the golden upsert function
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

-- Grant permissions
grant execute on function public.lexy_normalize_keyword(text) to anon, authenticated, service_role;
grant execute on function public.lexy_lower_eq_keyword(text, text) to anon, authenticated, service_role;
grant execute on function public.lexy_clip01(numeric) to anon, authenticated, service_role;
grant execute on function public.lexy_upsert_keyword to authenticated, service_role;

-- migrate:down
drop function if exists public.lexy_upsert_keyword;
drop function if exists public.lexy_clip01;
drop function if exists public.lexy_lower_eq_keyword;
drop trigger if exists trg_keywords_bu on public.keywords;
drop function if exists public.lexy_keywords_bu;
drop function if exists public.lexy_normalize_keyword;
drop index if exists keywords_term_normalized_idx;
drop index if exists keywords_market_source_ts_idx;
drop index if exists keywords_unique_key;

alter table public.keywords
  drop column if exists ingest_batch_id,
  drop column if exists ingest_source_key,
  drop column if exists ingest_source,
  drop column if exists term_normalized;
