-- migrate:up
-- Create raw_sources first so keyword ingest columns can reference it
create table if not exists public.raw_sources (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    source_type text not null,
    source_key text,
    status text not null default 'pending',
    payload jsonb not null,
    metadata jsonb not null default '{}'::jsonb,
    ingested_at timestamptz not null default now(),
    processed_at timestamptz,
    error text
);

create index if not exists raw_sources_provider_type_idx
    on public.raw_sources(provider, source_type);

create index if not exists raw_sources_status_idx
    on public.raw_sources(status);

-- Extend keywords with ingest metadata
alter table if exists public.keywords
    add column if not exists ingest_source text,
    add column if not exists ingest_source_key text,
    add column if not exists ingest_batch_id uuid,
    add column if not exists ingest_metadata jsonb not null default '{}'::jsonb,
    add column if not exists ingested_at timestamptz,
    add column if not exists raw_source_id uuid;

alter table if exists public.keywords
    add constraint if not exists keywords_raw_source_fk
        foreign key (raw_source_id) references public.raw_sources(id) on delete set null;

create index if not exists keywords_ingest_source_idx
    on public.keywords(ingest_source, ingest_source_key);

-- Update listings to support ingestion sourced records
alter table if exists public.listings
    alter column marketplace_account_id drop not null;

alter table if exists public.listings
    add column if not exists owner_user_id uuid,
    add column if not exists source text,
    add column if not exists source_listing_id text,
    add column if not exists source_shop_id text,
    add column if not exists first_seen_at timestamptz,
    add column if not exists last_seen_at timestamptz,
    add column if not exists popularity_score numeric(10,4);

alter table if exists public.listings
    alter column source set default 'manual',
    alter column first_seen_at set default now(),
    alter column last_seen_at set default now(),
    alter column popularity_score set default 0;

update public.listings l
set
    owner_user_id = coalesce(l.owner_user_id, ma.user_id),
    source = coalesce(l.source, 'synced'),
    first_seen_at = coalesce(l.first_seen_at, l.updated_at, now()),
    last_seen_at = coalesce(l.last_seen_at, l.updated_at, now())
from public.marketplace_accounts ma
where l.marketplace_account_id = ma.id;

alter table if exists public.listings
    alter column owner_user_id set not null;

create index if not exists listings_owner_idx
    on public.listings(owner_user_id, updated_at desc);

create index if not exists listings_source_idx
    on public.listings(source);

-- Seed manual provider + sentinel account for ingestion backed listings
insert into public.data_providers (id, display_name, provider_type, is_enabled)
values ('manual', 'Manual Import', 'synthetic', true)
on conflict (id) do update set
    display_name = excluded.display_name,
    provider_type = excluded.provider_type,
    is_enabled = excluded.is_enabled;

insert into public.marketplace_accounts (id, user_id, provider_id, external_shop_id, shop_name, status, metadata)
values (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000000',
    'manual',
    'manual',
    'Manual Imports',
    'active',
    jsonb_build_object('sentinel', true)
)
on conflict (id) do update set
    provider_id = excluded.provider_id,
    shop_name = excluded.shop_name,
    status = excluded.status,
    metadata = excluded.metadata;

-- Listing keywords bridge
create table if not exists public.listing_keywords (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings(id) on delete cascade,
    keyword_id uuid not null references public.keywords(id) on delete cascade,
    source text not null default 'ingest',
    relevance numeric(6,3),
    position integer,
    captured_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists listing_keywords_unique_idx
    on public.listing_keywords(listing_id, keyword_id, source);

create index if not exists listing_keywords_keyword_idx
    on public.listing_keywords(keyword_id);

-- Keyword lifecycle events
create table if not exists public.keyword_events (
    id bigserial primary key,
    keyword_id uuid not null references public.keywords(id) on delete cascade,
    listing_id uuid references public.listings(id) on delete set null,
    raw_source_id uuid references public.raw_sources(id) on delete set null,
    event_type text not null,
    occurred_at timestamptz not null default now(),
    payload jsonb not null default '{}'::jsonb,
    notes text
);

create index if not exists keyword_events_keyword_idx
    on public.keyword_events(keyword_id, occurred_at desc);

create index if not exists keyword_events_listing_idx
    on public.keyword_events(listing_id, occurred_at desc);

-- Keyword stats snapshots
create table if not exists public.keyword_stats (
    id bigserial primary key,
    keyword_id uuid not null references public.keywords(id) on delete cascade,
    source text not null,
    recorded_on date not null,
    search_volume integer,
    impressions integer,
    clicks integer,
    ctr numeric(10,4),
    conversion_rate numeric(10,4),
    cost_cents integer,
    rank integer,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists keyword_stats_unique_idx
    on public.keyword_stats(keyword_id, source, recorded_on);

-- Keyword SERP samples
create table if not exists public.keyword_serp_samples (
    id uuid primary key default gen_random_uuid(),
    keyword_id uuid not null references public.keywords(id) on delete cascade,
    listing_id uuid references public.listings(id) on delete set null,
    source text not null,
    position integer,
    url text,
    title text,
    snapshot jsonb not null default '{}'::jsonb,
    captured_at timestamptz not null default now()
);

create index if not exists keyword_serp_samples_keyword_idx
    on public.keyword_serp_samples(keyword_id, captured_at desc);

create index if not exists keyword_serp_samples_listing_idx
    on public.keyword_serp_samples(listing_id, captured_at desc);

-- Feature flags
create table if not exists public.feature_flags (
    key text primary key,
    description text,
    is_enabled boolean not null default false,
    rollout jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists feature_flags_enabled_idx
    on public.feature_flags(is_enabled);

-- migrate:down
-- Drop new tables first to clean up references
drop index if exists feature_flags_enabled_idx;
drop table if exists public.feature_flags;

drop index if exists keyword_serp_samples_listing_idx;
drop index if exists keyword_serp_samples_keyword_idx;
drop table if exists public.keyword_serp_samples;

drop index if exists keyword_stats_unique_idx;
drop table if exists public.keyword_stats;

drop index if exists keyword_events_listing_idx;
drop index if exists keyword_events_keyword_idx;
drop table if exists public.keyword_events;

drop index if exists listing_keywords_keyword_idx;
drop index if exists listing_keywords_unique_idx;
drop table if exists public.listing_keywords;

-- Remove sentinel account
delete from public.marketplace_accounts where id = '00000000-0000-0000-0000-000000000000';
delete from public.data_providers where id = 'manual';

-- Revert listings changes
DROP INDEX IF EXISTS public.listings_owner_idx;
DROP INDEX IF EXISTS public.listings_source_idx;

alter table if exists public.listings
    drop column if exists popularity_score,
    drop column if exists last_seen_at,
    drop column if exists first_seen_at,
    drop column if exists source_shop_id,
    drop column if exists source_listing_id,
    drop column if exists source,
    drop column if exists owner_user_id;

alter table if exists public.listings
    alter column marketplace_account_id set not null;

-- Revert keyword changes
alter table if exists public.keywords
    drop constraint if exists keywords_raw_source_fk;

drop index if exists public.keywords_ingest_source_idx;

drop table if exists public.raw_sources;

alter table if exists public.keywords
    drop column if exists raw_source_id,
    drop column if exists ingested_at,
    drop column if exists ingest_metadata,
    drop column if exists ingest_batch_id,
    drop column if exists ingest_source_key,
    drop column if exists ingest_source;
