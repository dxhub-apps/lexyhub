-- migrate:up
create extension if not exists pg_cron;

create materialized view if not exists public.keyword_insights
as
with stats_7d as (
    select
        keyword_id,
        sum(search_volume) as sum_search_volume,
        sum(impressions) as sum_impressions,
        sum(clicks) as sum_clicks,
        avg(search_volume)::numeric as avg_search_volume,
        avg(impressions)::numeric as avg_impressions,
        avg(clicks)::numeric as avg_clicks,
        avg(rank)::numeric as avg_rank,
        max(recorded_on) as max_recorded_on
    from public.keyword_stats
    where recorded_on >= current_date - 6
    group by keyword_id
),
stats_30d as (
    select
        keyword_id,
        sum(search_volume) as sum_search_volume,
        sum(impressions) as sum_impressions,
        sum(clicks) as sum_clicks,
        avg(search_volume)::numeric as avg_search_volume,
        avg(impressions)::numeric as avg_impressions,
        avg(clicks)::numeric as avg_clicks,
        avg(rank)::numeric as avg_rank,
        max(recorded_on) as max_recorded_on
    from public.keyword_stats
    where recorded_on >= current_date - 29
    group by keyword_id
),
serp_stats as (
    select
        keyword_id,
        count(distinct listing_id) filter (where listing_id is not null) as competitor_listings,
        max(captured_at) as last_serp_capture
    from public.keyword_serp_samples
    group by keyword_id
),
listing_touchpoints as (
    select
        ks.keyword_id,
        max(l.updated_at) as last_listing_update
    from public.keyword_serp_samples ks
    join public.listings l on l.id = ks.listing_id
    group by ks.keyword_id
)
select
    k.id as keyword_id,
    k.term as keyword,
    k.market,
    round(
        least(
            1.0,
            (
                coalesce(s7.sum_search_volume, 0)::numeric * 0.5 +
                coalesce(s7.sum_impressions, 0)::numeric * 0.3 +
                coalesce(s7.sum_clicks, 0)::numeric * 0.2
            ) / greatest(1::numeric, coalesce(s30.sum_search_volume, 0)::numeric)
        ),
        3
    ) as demand_index,
    round(
        least(
            1.0,
            coalesce(serp.competitor_listings, 0)::numeric / 50.0
        ),
        3
    ) as competition_score,
    round(
        coalesce(s7.avg_search_volume, 0)::numeric - coalesce(s30.avg_search_volume, 0)::numeric,
        3
    ) as trend_momentum_delta,
    greatest(
        coalesce(k.freshness_ts, to_timestamp(0)),
        coalesce(s30.max_recorded_on::timestamptz, to_timestamp(0)),
        coalesce(serp.last_serp_capture, to_timestamp(0)),
        coalesce(lt.last_listing_update, to_timestamp(0))
    ) as freshness_ts,
    coalesce(s7.sum_search_volume, 0) as search_volume_7d,
    coalesce(s30.sum_search_volume, 0) as search_volume_30d,
    coalesce(serp.competitor_listings, 0) as competitor_listings,
    coalesce(s7.avg_rank, s30.avg_rank) as average_rank
from public.keywords k
left join stats_7d s7 on s7.keyword_id = k.id
left join stats_30d s30 on s30.keyword_id = k.id
left join serp_stats serp on serp.keyword_id = k.id
left join listing_touchpoints lt on lt.keyword_id = k.id;

comment on materialized view public.keyword_insights is
    'Aggregated keyword performance metrics combining stats, SERP samples, and listing freshness.';

create unique index if not exists keyword_insights_keyword_id_idx
    on public.keyword_insights (keyword_id);

create index if not exists keyword_insights_keyword_idx
    on public.keyword_insights (keyword);

create index if not exists keyword_insights_market_idx
    on public.keyword_insights (market);

alter materialized view public.keyword_insights owner to postgres;

grant select on materialized view public.keyword_insights to service_role;

do $$
begin
    begin
        execute 'alter table public.keyword_insights enable row level security';
    exception
        when others then
            raise notice 'Skipping RLS enable for keyword_insights: %', SQLERRM;
    end;

    if not exists (
        select 1
        from pg_catalog.pg_policies
        where schemaname = 'public'
          and tablename = 'keyword_insights'
          and policyname = 'keyword_insights_service_role_select'
    ) then
        begin
            execute $$create policy keyword_insights_service_role_select on public.keyword_insights for select using (auth.role() = 'service_role')$$;
        exception
            when others then
                raise notice 'Skipping policy creation for keyword_insights: %', SQLERRM;
        end;
    end if;
end;
$$;

create or replace function public.refresh_keyword_insights(scope text default 'all')
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
    last_refresh timestamptz;
    should_refresh boolean := true;
    threshold interval;
begin
    select last_refresh
    into last_refresh
    from pg_catalog.pg_matviews
    where schemaname = 'public'
      and matviewname = 'keyword_insights';

    if scope = 'hot' then
        threshold := interval '15 minutes';
    elsif scope = 'cold' then
        threshold := interval '6 hours';
    else
        threshold := null;
    end if;

    if threshold is not null
       and last_refresh is not null
       and last_refresh > now() - threshold then
        should_refresh := false;
    end if;

    if should_refresh then
        refresh materialized view public.keyword_insights;

        select last_refresh
        into last_refresh
        from pg_catalog.pg_matviews
        where schemaname = 'public'
          and matviewname = 'keyword_insights';
    end if;

    return last_refresh;
end;
$$;

create or replace function public.refresh_keyword_insights_hot()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.refresh_keyword_insights('hot');
end;
$$;

create or replace function public.refresh_keyword_insights_cold()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
begin
    return public.refresh_keyword_insights('cold');
end;
$$;

do $$
begin
    if not exists (
        select 1
        from cron.job
        where jobname = 'keyword_insights_hot_refresh'
    ) then
        perform cron.schedule(
            'keyword_insights_hot_refresh',
            '*/15 * * * *',
            $$select public.refresh_keyword_insights_hot();$$
        );
    end if;

    if not exists (
        select 1
        from cron.job
        where jobname = 'keyword_insights_cold_refresh'
    ) then
        perform cron.schedule(
            'keyword_insights_cold_refresh',
            '5 */6 * * *',
            $$select public.refresh_keyword_insights_cold();$$
        );
    end if;
end;
$$;

-- migrate:down
do $$
declare
    job_id integer;
begin
    select jobid into job_id
    from cron.job
    where jobname = 'keyword_insights_hot_refresh';

    if job_id is not null then
        perform cron.unschedule(job_id);
    end if;

    select jobid into job_id
    from cron.job
    where jobname = 'keyword_insights_cold_refresh';

    if job_id is not null then
        perform cron.unschedule(job_id);
    end if;
end;
$$;

drop function if exists public.refresh_keyword_insights_hot();
drop function if exists public.refresh_keyword_insights_cold();
drop function if exists public.refresh_keyword_insights(text);

drop policy if exists keyword_insights_service_role_select on public.keyword_insights;
alter table if exists public.keyword_insights disable row level security;

drop index if exists keyword_insights_market_idx;
drop index if exists keyword_insights_keyword_idx;
drop index if exists keyword_insights_keyword_id_idx;

drop materialized view if exists public.keyword_insights;

drop extension if exists pg_cron;
