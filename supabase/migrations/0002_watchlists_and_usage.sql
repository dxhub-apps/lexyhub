-- ===========================================
-- 0002_watchlists_and_usage.sql (corrected)
-- ===========================================
-- migrate:up
-- depends on 0001, but make it defensive

-- watchlists
create table if not exists public.watchlists (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    name text not null,
    description text,
    item_type text not null default 'keyword',
    capacity integer not null default 25,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
    id uuid primary key default gen_random_uuid(),
    watchlist_id uuid not null references public.watchlists(id) on delete cascade,
    keyword_id uuid references public.keywords(id) on delete cascade,
    listing_id uuid,
    added_by uuid not null,
    added_at timestamptz not null default now(),
    constraint watchlist_items_keyword_listing_ck check (
        (keyword_id is not null)::int + (listing_id is not null)::int = 1
    )
);

create unique index if not exists watchlist_items_unique_idx
    on public.watchlist_items(watchlist_id, coalesce(keyword_id::text, listing_id::text));

-- usage events
create table if not exists public.usage_events (
    id bigserial primary key,
    user_id uuid not null,
    event_type text not null,
    amount integer not null default 0,
    source text,
    occurred_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb
);

create index if not exists usage_events_user_idx
    on public.usage_events(user_id, occurred_at desc);

-- daily rollups
create table if not exists public.daily_usage_rollups (
    user_id uuid not null,
    usage_date date not null,
    event_type text not null,
    total_amount integer not null default 0,
    created_at timestamptz not null default now(),
    primary key (user_id, usage_date, event_type)
);

-- job runs
create table if not exists public.job_runs (
    id uuid primary key default gen_random_uuid(),
    job_name text not null,
    status text not null,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    records_processed integer,
    tokens_consumed integer,
    error_message text,
    metadata jsonb default '{}'::jsonb
);

create index if not exists job_runs_name_idx
    on public.job_runs(job_name, started_at desc);

-- ai usage events
-- if 0001 was applied, public.ai_predictions exists; if not, FK will still succeed because the table exists
create table if not exists public.ai_usage_events (
    id bigserial primary key,
    user_id uuid,
    ai_prediction_id uuid references public.ai_predictions(id) on delete set null,
    model text,
    tokens_prompt integer default 0,
    tokens_completion integer default 0,
    cost numeric(10,4),
    occurred_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb
);

comment on table public.watchlists is 'User-managed collections of keywords or listings.';
comment on table public.watchlist_items is 'Items within a watchlist mapped to keywords or listings.';
comment on table public.usage_events is 'Granular usage tracking for quotas and billing.';
comment on table public.daily_usage_rollups is 'Aggregated usage totals per user/day/event type.';
comment on table public.job_runs is 'Background job execution log with cost metrics.';
comment on table public.ai_usage_events is 'AI token consumption tracking for transparency and billing.';

-- migrate:down
drop table if exists public.ai_usage_events cascade;
drop index if exists job_runs_name_idx;
drop table if exists public.job_runs cascade;
drop table if exists public.daily_usage_rollups cascade;
drop index if exists usage_events_user_idx;
drop table if exists public.usage_events cascade;
drop index if exists watchlist_items_unique_idx;
drop table if exists public.watchlist_items cascade;
drop table if exists public.watchlists cascade;
