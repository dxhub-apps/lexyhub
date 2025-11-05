-- migrate:up
-- ===========================================
-- 0023_keyword_timeseries.sql
-- Timeseries storage for enrichment pipeline
-- ===========================================

create table if not exists public.keyword_timeseries (
  id bigserial primary key,
  term_normalized text not null,
  market text not null,
  source text not null,
  ts_date date not null,
  demand numeric(8,3),
  competition numeric(8,3),
  engagement numeric(8,3),
  volume_raw numeric(12,3),
  score_raw numeric(8,3),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists kts_uk
  on public.keyword_timeseries(term_normalized, market, source, ts_date);

create index if not exists kts_recent_idx
  on public.keyword_timeseries(ts_date desc);

create index if not exists kts_market_source_idx
  on public.keyword_timeseries(market, source);

-- Enrichment function that updates trend_momentum and adjusted_demand_index
create or replace function public.lexy_update_enrichment(p_market text, p_source text)
returns void language plpgsql as $$
declare
  rec record;
  v_trend_momentum numeric;
  v_base_demand numeric;
  v_adjusted_demand numeric;
begin
  for rec in
    with base as (
      select
        term_normalized, market, source,
        array_agg(volume_raw order by ts_date) as vols,
        array_agg(demand order by ts_date) as demands,
        array_agg(ts_date order by ts_date desc) as dates
      from public.keyword_timeseries
      where market = p_market and source = p_source
        and ts_date >= current_date - interval '30 days'
      group by 1,2,3
    )
    select
      term_normalized,
      market,
      source,
      vols,
      demands,
      dates
    from base
    where array_length(demands, 1) >= 2
  loop
    -- Simple momentum: (latest - previous) / previous
    v_base_demand := rec.demands[array_length(rec.demands, 1)];

    if array_length(rec.demands, 1) >= 2 then
      declare
        v_prev numeric := rec.demands[array_length(rec.demands, 1) - 1];
      begin
        if v_prev > 0 then
          v_trend_momentum := public.lexy_clip01((v_base_demand - v_prev) / v_prev);
        else
          v_trend_momentum := 0.5;
        end if;
      end;
    else
      v_trend_momentum := 0.5;
    end if;

    v_adjusted_demand := public.lexy_clip01(v_base_demand);

    update public.keywords k
    set
      base_demand_index = public.lexy_clip01(coalesce(k.demand_index, v_base_demand)),
      adjusted_demand_index = v_adjusted_demand,
      trend_momentum = v_trend_momentum,
      deseasoned_trend_momentum = coalesce(k.deseasoned_trend_momentum, v_trend_momentum),
      freshness_ts = greatest(coalesce(k.freshness_ts, now()), now())
    where k.term_normalized = rec.term_normalized
      and k.market = rec.market
      and k.source = rec.source;
  end loop;
end
$$;

grant execute on function public.lexy_update_enrichment to service_role;
grant select, insert, update on public.keyword_timeseries to service_role, authenticated;

-- migrate:down
drop function if exists public.lexy_update_enrichment;
drop table if exists public.keyword_timeseries cascade;
