-- ===========================================
-- 0010_keyword_search_requests.sql
-- ===========================================
-- migrate:up
create table if not exists public.keyword_search_requests (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    query text not null,
    normalized_query text not null,
    market text not null,
    plan text not null,
    sources text[] not null default array[]::text[],
    reason text not null default 'no_results',
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists keyword_search_requests_created_at_idx
    on public.keyword_search_requests(created_at desc);

comment on table public.keyword_search_requests is 'Records keyword searches that lacked results to guide data backfilling.';
comment on column public.keyword_search_requests.user_id is 'Optional identifier linking the search to a LexyHub user.';
comment on column public.keyword_search_requests.query is 'Original keyword query provided by the user.';
comment on column public.keyword_search_requests.normalized_query is 'Normalized variant of the query used for matching and deduplication.';
comment on column public.keyword_search_requests.reason is 'Why the search was recorded (e.g., no_results).';

-- migrate:down
drop index if exists keyword_search_requests_created_at_idx;
drop table if exists public.keyword_search_requests cascade;
