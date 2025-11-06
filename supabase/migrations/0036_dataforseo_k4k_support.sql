-- migrate:up
-- ===========================================
-- 0036_dataforseo_k4k_support.sql
-- Add DataForSEO K4K support to keyword_seeds
-- ===========================================

-- Add columns needed for DataForSEO ingestion
alter table public.keyword_seeds
  add column if not exists enabled boolean not null default true,
  add column if not exists language_code text default 'en',
  add column if not exists location_code text default '2840';

-- Create index for efficient filtering of enabled seeds
create index if not exists keyword_seeds_enabled_idx
  on public.keyword_seeds(enabled) where enabled = true;

-- Create index for locale grouping (used by batching logic)
create index if not exists keyword_seeds_locale_idx
  on public.keyword_seeds(language_code, location_code);

-- Create unique constraint on source_key for raw_sources to prevent duplicates
create unique index if not exists raw_sources_source_key_unique
  on public.raw_sources(provider, source_type, source_key)
  where source_key is not null;

-- Add comment
comment on column public.keyword_seeds.enabled is 'Whether this seed should be included in ingestion runs';
comment on column public.keyword_seeds.language_code is 'ISO language code for DataForSEO (e.g., en, es, fr)';
comment on column public.keyword_seeds.location_code is 'DataForSEO location code (e.g., 2840 for USA)';

-- migrate:down
drop index if exists public.raw_sources_source_key_unique;
drop index if exists public.keyword_seeds_locale_idx;
drop index if exists public.keyword_seeds_enabled_idx;

alter table public.keyword_seeds
  drop column if exists location_code,
  drop column if exists language_code,
  drop column if exists enabled;
