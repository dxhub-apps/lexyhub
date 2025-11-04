-- migrate:up
-- ===========================================
-- 0021_add_seasonality_and_trend.sql
-- Seasonal-aware Demand Index and Trend Momentum
-- ===========================================

-- Extensions
create extension if not exists pgcrypto;

-- Table: seasonal_periods
create table if not exists public.seasonal_periods (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    country_code text,
    start_date date not null,
    end_date date not null,
    weight numeric not null default 1.0,
    tags text[] default array[]::text[],
    created_at timestamptz not null default now()
);

create index if not exists seasonal_periods_dates_idx on public.seasonal_periods(start_date, end_date);
create index if not exists seasonal_periods_country_idx on public.seasonal_periods(country_code);

-- Table: keyword_metrics_daily
create table if not exists public.keyword_metrics_daily (
    id uuid primary key default gen_random_uuid(),
    keyword_id uuid not null references public.keywords(id) on delete cascade,
    collected_on date not null,
    volume numeric,
    traffic_rank numeric,
    competition_score numeric,
    engagement numeric,
    ai_confidence numeric,
    source text not null,
    extras jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(keyword_id, collected_on, source)
);

create index if not exists keyword_metrics_daily_keyword_date_idx on public.keyword_metrics_daily(keyword_id, collected_on desc);
create index if not exists keyword_metrics_daily_source_idx on public.keyword_metrics_daily(source);

-- Table: demand_trend_runs
create table if not exists public.demand_trend_runs (
    id uuid primary key default gen_random_uuid(),
    ran_at timestamptz not null default now(),
    window_days int not null,
    status text not null,
    stats jsonb not null default '{}'::jsonb,
    error text
);

create index if not exists demand_trend_runs_ran_at_idx on public.demand_trend_runs(ran_at desc);

-- Extend keywords table
alter table public.keywords
    add column if not exists base_demand_index numeric,
    add column if not exists adjusted_demand_index numeric,
    add column if not exists deseasoned_trend_momentum numeric,
    add column if not exists seasonal_label text,
    add column if not exists first_seen timestamptz,
    add column if not exists last_seen timestamptz;

create index if not exists keywords_adjusted_di_idx on public.keywords(adjusted_demand_index desc nulls last);
create index if not exists keywords_trend_momentum_idx on public.keywords(trend_momentum desc nulls last);
create index if not exists keywords_last_seen_idx on public.keywords(last_seen desc nulls last);

-- Function: current_season_weight
create or replace function public.current_season_weight(_as_of date default current_date, _country text default 'global')
returns table(name text, weight numeric, label text)
language plpgsql
stable
as $$
begin
    return query
    select
        sp.name,
        sp.weight,
        sp.name as label
    from public.seasonal_periods sp
    where _as_of between sp.start_date and sp.end_date
      and (sp.country_code = _country or sp.country_code is null or sp.country_code = 'global')
    order by sp.weight desc
    limit 1;
end;
$$;

-- Function: compute_base_demand_index
create or replace function public.compute_base_demand_index(_kw uuid, _as_of date default current_date, _source text default 'lexyhub')
returns numeric
language plpgsql
stable
as $$
declare
    _volume numeric;
    _traffic_rank numeric;
    _comp_score numeric;
    _ai_conf numeric;
    _base_di numeric;
begin
    select volume, traffic_rank, competition_score, ai_confidence
    into _volume, _traffic_rank, _comp_score, _ai_conf
    from public.keyword_metrics_daily
    where keyword_id = _kw
      and collected_on = _as_of
      and source = _source
    order by created_at desc
    limit 1;

    if _volume is null and _traffic_rank is null then
        return null;
    end if;

    -- Normalize volume (log scale, 0-100)
    _volume := coalesce(_volume, 0);
    _volume := case when _volume > 0 then least(100, (ln(_volume + 1) / ln(1000000)) * 100) else 0 end;

    -- Normalize traffic rank (inverse, 0-100)
    _traffic_rank := coalesce(_traffic_rank, 0);
    _traffic_rank := case when _traffic_rank > 0 then least(100, 100 - (ln(_traffic_rank) / ln(1000000)) * 100) else 50 end;

    -- Competition score (0-100, AI-predicted if missing)
    _comp_score := coalesce(_comp_score, 50.0);

    -- Weighted average: 40% volume, 30% traffic, 30% competition
    _base_di := (0.4 * _volume) + (0.3 * _traffic_rank) + (0.3 * (100 - _comp_score));

    return round(_base_di, 3);
end;
$$;

-- Function: compute_adjusted_demand_index
create or replace function public.compute_adjusted_demand_index(_kw uuid, _as_of date default current_date, _source text default 'lexyhub', _country text default 'global')
returns numeric
language plpgsql
stable
as $$
declare
    _base_di numeric;
    _seasonal_weight numeric;
    _adjusted_di numeric;
begin
    _base_di := public.compute_base_demand_index(_kw, _as_of, _source);

    if _base_di is null then
        return null;
    end if;

    select weight into _seasonal_weight
    from public.current_season_weight(_as_of, _country);

    _seasonal_weight := coalesce(_seasonal_weight, 1.0);
    _adjusted_di := _base_di * _seasonal_weight;

    return round(least(_adjusted_di, 100), 3);
end;
$$;

-- Function: seasonal_baseline_di
create or replace function public.seasonal_baseline_di(_kw uuid, _as_of date default current_date, _source text default 'lexyhub', _window int default 14)
returns numeric
language plpgsql
stable
as $$
declare
    _avg_di numeric;
    _start_date date;
begin
    -- Look at same period last year
    _start_date := _as_of - interval '1 year' - (_window || ' days')::interval;

    select avg(public.compute_base_demand_index(_kw, kmd.collected_on, _source))
    into _avg_di
    from public.keyword_metrics_daily kmd
    where kmd.keyword_id = _kw
      and kmd.collected_on between _start_date and (_as_of - interval '1 year')
      and kmd.source = _source;

    return coalesce(_avg_di, 50.0);
end;
$$;

-- Function: compute_deseasoned_tm
create or replace function public.compute_deseasoned_tm(_kw uuid, _as_of date default current_date, _source text default 'lexyhub', _lookback int default 7)
returns numeric
language plpgsql
stable
as $$
declare
    _adjusted_di numeric;
    _seasonal_baseline numeric;
    _deseasoned_tm numeric;
begin
    _adjusted_di := public.compute_adjusted_demand_index(_kw, _as_of, _source, 'global');
    _seasonal_baseline := public.seasonal_baseline_di(_kw, _as_of, _source, _lookback);

    if _adjusted_di is null or _seasonal_baseline = 0 then
        return null;
    end if;

    _deseasoned_tm := ((_adjusted_di / _seasonal_baseline) - 1.0) * 100;

    return round(_deseasoned_tm, 3);
end;
$$;

-- Function: compute_trend_momentum
create or replace function public.compute_trend_momentum(_kw uuid, _as_of date default current_date, _source text default 'lexyhub', _lookback int default 7)
returns numeric
language plpgsql
stable
as $$
declare
    _current_di numeric;
    _prev_di numeric;
    _trend_momentum numeric;
    _start_date date;
begin
    _start_date := _as_of - (_lookback || ' days')::interval;

    _current_di := public.compute_base_demand_index(_kw, _as_of, _source);

    select avg(public.compute_base_demand_index(_kw, kmd.collected_on, _source))
    into _prev_di
    from public.keyword_metrics_daily kmd
    where kmd.keyword_id = _kw
      and kmd.collected_on between _start_date and _as_of - 1
      and kmd.source = _source;

    if _current_di is null or _prev_di is null or _prev_di = 0 then
        return null;
    end if;

    _trend_momentum := ((_current_di / _prev_di) - 1.0) * 100;

    return round(_trend_momentum, 3);
end;
$$;

-- Function: apply_demand_trend_for_date
create or replace function public.apply_demand_trend_for_date(_as_of date default current_date, _source text default 'lexyhub', _country text default 'global', _lookback int default 7)
returns int
language plpgsql
as $$
declare
    _updated_count int := 0;
    _kw record;
    _seasonal_label text;
begin
    select label into _seasonal_label
    from public.current_season_weight(_as_of, _country);

    for _kw in
        select distinct k.id
        from public.keywords k
        inner join public.keyword_metrics_daily kmd on k.id = kmd.keyword_id
        where kmd.collected_on = _as_of
          and kmd.source = _source
    loop
        update public.keywords
        set
            base_demand_index = public.compute_base_demand_index(_kw.id, _as_of, _source),
            adjusted_demand_index = public.compute_adjusted_demand_index(_kw.id, _as_of, _source, _country),
            trend_momentum = public.compute_trend_momentum(_kw.id, _as_of, _source, _lookback),
            deseasoned_trend_momentum = public.compute_deseasoned_tm(_kw.id, _as_of, _source, _lookback),
            seasonal_label = _seasonal_label,
            last_seen = now()
        where id = _kw.id;

        _updated_count := _updated_count + 1;
    end loop;

    return _updated_count;
end;
$$;

-- View: v_keywords_scored
create or replace view public.v_keywords_scored as
select
    k.id,
    k.term,
    k.source,
    k.market,
    k.tier,
    k.base_demand_index,
    k.adjusted_demand_index,
    k.trend_momentum,
    k.deseasoned_trend_momentum,
    k.seasonal_label,
    k.competition_score,
    k.engagement_score,
    k.ai_opportunity_score,
    k.first_seen,
    k.last_seen,
    k.freshness_ts,
    k.extras,
    case
        when k.trend_momentum > 10 and k.adjusted_demand_index > 70 then 'hot'
        when k.trend_momentum > 5 and k.adjusted_demand_index > 50 then 'rising'
        when k.trend_momentum between -5 and 5 then 'stable'
        when k.trend_momentum < -5 then 'cooling'
        else 'unknown'
    end as opportunity_badge
from public.keywords k
where k.adjusted_demand_index is not null;

-- Permissions
grant select on public.seasonal_periods to anon, authenticated, service_role;
grant select on public.keyword_metrics_daily to anon, authenticated, service_role;
grant select on public.demand_trend_runs to anon, authenticated, service_role;
grant select on public.v_keywords_scored to anon, authenticated, service_role;

grant insert, update on public.seasonal_periods to service_role;
grant insert, update on public.keyword_metrics_daily to service_role;
grant insert, update on public.demand_trend_runs to service_role;

-- Seed seasonal_periods
insert into public.seasonal_periods (name, country_code, start_date, end_date, weight, tags) values
    ('Black Friday', 'global', '2024-11-20', '2024-12-01', 1.5, array['retail', 'ecommerce']),
    ('Cyber Monday', 'global', '2024-12-01', '2024-12-03', 1.3, array['retail', 'ecommerce']),
    ('Christmas', 'global', '2024-12-01', '2024-12-31', 1.8, array['retail', 'holiday']),
    ('New Year', 'global', '2024-12-26', '2025-01-07', 1.6, array['retail', 'holiday']),
    ('Valentine''s Day', 'global', '2025-02-01', '2025-02-15', 1.4, array['retail', 'holiday']),
    ('Easter', 'global', '2025-03-15', '2025-04-25', 1.3, array['retail', 'holiday']),
    ('Mother''s Day', 'global', '2025-05-01', '2025-05-15', 1.4, array['retail', 'holiday']),
    ('Father''s Day', 'global', '2025-06-01', '2025-06-20', 1.2, array['retail', 'holiday']),
    ('Back to School', 'global', '2025-08-15', '2025-09-15', 1.3, array['retail', 'education']),
    ('Halloween', 'global', '2025-10-15', '2025-10-31', 1.4, array['retail', 'holiday']),
    ('Singles'' Day', 'CN', '2024-11-01', '2024-11-12', 1.6, array['retail', 'ecommerce']),
    ('Summer Sales', 'global', '2025-06-15', '2025-08-01', 1.2, array['retail', 'seasonal']),
    ('Q4 Global Uplift', 'global', '2024-10-01', '2024-12-31', 1.2, array['retail', 'ecommerce']),
    ('Golden Week Japan', 'JP', '2025-04-29', '2025-05-05', 1.3, array['retail', 'holiday']),
    ('Golden Week China', 'CN', '2025-05-01', '2025-05-05', 1.3, array['retail', 'holiday']),
    ('Independence Day US', 'US', '2025-07-01', '2025-07-07', 1.2, array['retail', 'holiday'])
on conflict do nothing;

-- migrate:down
drop view if exists public.v_keywords_scored;
drop function if exists public.apply_demand_trend_for_date;
drop function if exists public.compute_trend_momentum;
drop function if exists public.compute_deseasoned_tm;
drop function if exists public.seasonal_baseline_di;
drop function if exists public.compute_adjusted_demand_index;
drop function if exists public.compute_base_demand_index;
drop function if exists public.current_season_weight;

alter table public.keywords
    drop column if exists seasonal_label,
    drop column if exists deseasoned_trend_momentum,
    drop column if exists adjusted_demand_index,
    drop column if exists base_demand_index,
    drop column if exists last_seen,
    drop column if exists first_seen;

drop index if exists keywords_last_seen_idx;
drop index if exists keywords_trend_momentum_idx;
drop index if exists keywords_adjusted_di_idx;

drop table if exists public.demand_trend_runs;
drop table if exists public.keyword_metrics_daily;
drop table if exists public.seasonal_periods;
