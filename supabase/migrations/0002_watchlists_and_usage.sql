-- migrate:up

-- 1) ensure core tables from 0001 exist (idempotent safety)
create table if not exists public.keywords (
    id uuid primary key,
    term text not null,
    source text not null,
    market text not null
);

-- 2) watchlists
create table if not exists public.watchlists (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null,
    name text not null,
    description text,
    visibility text not null default 'private', -- private | org | public
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 3) watchlist items
-- note: keyword_id is optional; listing_id is optional; exactly one must be set
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

create index if not exists watchlist_items_watchlist_id_idx
    on public.watchlist_items(watchlist_id);

create index if not exists watchlist_items_keyword_id_idx
    on public.watchlist_items(keyword_id);

-- 4) usage tracking per user
create table if not exists public.usage_events (
    id bigserial primary key,
    user_id uuid not null,
    event_type text not null, -- e.g. 'query.run', 'ai.predict', 'keyword.expand'
    subject_id uuid,
    meta jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);
create index if not exists usage_events_user_created_idx
    on public.usage_events(user_id, created_at desc);

-- 5) daily aggregates
create table if not exists public.usage_daily (
    user_id uuid not null,
    day date not null,
    event_type text not null,
    count integer not null default 0,
    meta jsonb default '{}'::jsonb,
    primary key (user_id, day, event_type)
);

comment on table public.watchlists is 'Named collections of keywords/listings for a user or org.';
comment on table public.watchlist_items is 'Items inside a watchlist. Exactly one of keyword_id or listing_id.';
comment on table public.usage_events is 'Raw usage events for metering and analytics.';
comment on table public.usage_daily is 'Daily rollups of usage per user and event type.';

-- migrate:down

drop table if exists public.usage_daily cascade;
drop table if exists public.usage_events cascade;
drop table if exists public.watchlist_items cascade;
drop table if exists public.watchlists cascade;

-- do NOT drop public.keywords here; it belongs to 0001
