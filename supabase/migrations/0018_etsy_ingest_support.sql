-- migrate:up
create table if not exists public.listing_keywords (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings(id) on delete cascade,
    keyword_id uuid not null references public.keywords(id) on delete cascade,
    source text not null default 'unknown',
    confidence numeric(6,3),
    created_at timestamptz not null default now(),
    unique(listing_id, keyword_id, source)
);

create table if not exists public.raw_sources (
    id uuid primary key default gen_random_uuid(),
    provider_id text not null references public.data_providers(id),
    provider_name text not null,
    ingested_at timestamptz not null default now(),
    payload jsonb not null,
    metadata jsonb default '{}'::jsonb
);

create index if not exists raw_sources_provider_idx on public.raw_sources(provider_id, ingested_at desc);

comment on table public.listing_keywords is 'Join table linking listings to keywords with provenance metadata.';
comment on table public.raw_sources is 'Raw payloads collected from upstream providers for auditing and replay.';

-- migrate:down
drop index if exists raw_sources_provider_idx;
drop table if exists public.raw_sources cascade;
drop table if exists public.listing_keywords cascade;
