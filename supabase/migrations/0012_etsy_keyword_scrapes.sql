-- ===========================================
-- 0012_etsy_keyword_scrapes.sql
-- ===========================================
-- migrate:up
create table if not exists public.etsy_keyword_scrapes (
    id uuid primary key default gen_random_uuid(),
    query text not null,
    normalized_query text not null,
    suggestions text[] not null,
    source text not null default 'etsy_autocomplete',
    scraped_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    extras jsonb default '{}'::jsonb
);

create index if not exists etsy_keyword_scrapes_query_idx
    on public.etsy_keyword_scrapes (normalized_query, scraped_at desc);

comment on table public.etsy_keyword_scrapes is 'Raw captures of Etsy keyword suggestion runs.';
comment on column public.etsy_keyword_scrapes.query is 'Original keyword or phrase submitted to the public Etsy search endpoints.';
comment on column public.etsy_keyword_scrapes.normalized_query is 'Lowercase trimmed variant of the query used for deduplication.';
comment on column public.etsy_keyword_scrapes.suggestions is 'Ordered list of keyword suggestions returned for the query.';
comment on column public.etsy_keyword_scrapes.source is 'Origin channel for the scrape (e.g., etsy_autocomplete).';

-- migrate:down
drop index if exists etsy_keyword_scrapes_query_idx;
drop table if exists public.etsy_keyword_scrapes cascade;
