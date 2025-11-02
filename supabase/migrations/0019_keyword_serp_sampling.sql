-- 0019_keyword_serp_sampling.sql
-- Introduce keyword SERP sampling controls and helpers.

-- migrate:up
alter table if exists public.keywords
    add column if not exists allow_search_sampling boolean not null default false;

comment on column public.keywords.allow_search_sampling is 'When true, background jobs may sample live SERPs for this keyword.';

alter table if exists public.keyword_serp_samples
    add column if not exists derived_metrics jsonb not null default '{}'::jsonb,
    add column if not exists tags text[] not null default array[]::text[],
    add column if not exists total_results integer;

create or replace function public.keyword_serp_sampling_candidates(sample_limit integer default 25)
returns table (
    keyword_id uuid,
    term text,
    market text,
    watchlist_count integer,
    last_sample timestamptz,
    last_stat date
)
language sql
set search_path = public
as $$
with watchlist_counts as (
    select keyword_id, count(*) as watchlist_count
    from public.watchlist_items
    where keyword_id is not null
    group by keyword_id
),
latest_samples as (
    select keyword_id, max(captured_at) as last_sample
    from public.keyword_serp_samples
    group by keyword_id
),
latest_stats as (
    select keyword_id, max(recorded_on) as last_stat
    from public.keyword_stats
    group by keyword_id
)
select
    k.id as keyword_id,
    k.term,
    k.market,
    coalesce(w.watchlist_count, 0) as watchlist_count,
    s.last_sample,
    st.last_stat
from public.keywords k
left join watchlist_counts w on w.keyword_id = k.id
left join latest_samples s on s.keyword_id = k.id
left join latest_stats st on st.keyword_id = k.id
where k.allow_search_sampling is true
order by
    coalesce(w.watchlist_count, 0) desc,
    coalesce(s.last_sample, to_timestamp(0)) asc,
    coalesce(st.last_stat, '1970-01-01'::date) asc,
    k.created_at asc
limit sample_limit;
$$;

comment on function public.keyword_serp_sampling_candidates(integer) is 'Returns SERP sampling candidates prioritizing watchlisted keywords and stale samples.';

-- migrate:down
drop function if exists public.keyword_serp_sampling_candidates(integer);

alter table if exists public.keyword_serp_samples
    drop column if exists derived_metrics,
    drop column if exists tags,
    drop column if exists total_results;

alter table if exists public.keywords
    drop column if exists allow_search_sampling;
