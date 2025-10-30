-- migrate:up
create table if not exists public.keyword_insights_cache (
    cache_key text primary key,
    query text not null,
    market text not null,
    plan text not null,
    sources text[] not null default array[]::text[],
    summary text not null,
    model text not null,
    generated_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    extras jsonb default '{}'::jsonb
);

create index if not exists keyword_insights_cache_query_idx
    on public.keyword_insights_cache (query, market);

comment on table public.keyword_insights_cache is 'Caches AI keyword insights summaries to avoid redundant API calls.';

-- migrate:down
drop index if exists keyword_insights_cache_query_idx;
drop table if exists public.keyword_insights_cache cascade;
