-- migrate:up
create or replace function public.keyword_telemetry_rollup(
    window_start timestamptz,
    window_end timestamptz default now()
)
returns table (
    keyword_id uuid,
    source text,
    recorded_on date,
    search_volume integer,
    impressions integer,
    clicks integer,
    ctr numeric(10,4),
    conversion_rate numeric(10,4),
    cost_cents integer,
    rank numeric,
    metadata jsonb
)
language sql
stable
as $$
with relevant as (
    select
        ke.*, 
        coalesce(ke.payload ->> 'event_id', ke.id::text) as dedupe_key,
        coalesce(ke.payload ->> 'source', ke.event_type) as source
    from public.keyword_events ke
    where ke.occurred_at >= coalesce(window_start, now() - interval '30 days')
      and ke.occurred_at < coalesce(window_end, now())
),
deduped as (
    select distinct on (dedupe_key)
        keyword_id,
        source,
        occurred_at::date as recorded_on,
        nullif((payload ->> 'search_volume')::int, 0) as search_volume,
        nullif((payload ->> 'impressions')::int, 0) as impressions,
        nullif((payload ->> 'clicks')::int, 0) as clicks,
        nullif((payload ->> 'conversions')::int, 0) as conversions,
        nullif((payload ->> 'cost_cents')::int, 0) as cost_cents,
        (payload ->> 'rank')::numeric as rank,
        dedupe_key
    from relevant
    order by dedupe_key, occurred_at desc
)
select
    keyword_id,
    source,
    recorded_on,
    nullif(sum(coalesce(search_volume, 0))::bigint, 0)::int as search_volume,
    nullif(sum(coalesce(impressions, 0))::bigint, 0)::int as impressions,
    nullif(sum(coalesce(clicks, 0))::bigint, 0)::int as clicks,
    case
        when sum(coalesce(impressions, 0)) > 0
            then round(sum(coalesce(clicks, 0))::numeric / nullif(sum(coalesce(impressions, 0))::numeric, 0), 4)
        else null
    end as ctr,
    case
        when sum(coalesce(clicks, 0)) > 0 and sum(coalesce(conversions, 0)) > 0
            then round(sum(coalesce(conversions, 0))::numeric / nullif(sum(coalesce(clicks, 0))::numeric, 0), 4)
        else null
    end as conversion_rate,
    nullif(sum(coalesce(cost_cents, 0))::bigint, 0)::int as cost_cents,
    avg(rank) as rank,
    jsonb_build_object(
        'eventCount', count(*),
        'windowStart', to_char(min(recorded_on), 'YYYY-MM-DD'),
        'windowEnd', to_char(max(recorded_on), 'YYYY-MM-DD')
    ) as metadata
from deduped
group by keyword_id, source, recorded_on
order by keyword_id, source, recorded_on;
$$;

-- migrate:down
drop function if exists public.keyword_telemetry_rollup(timestamptz, timestamptz);
