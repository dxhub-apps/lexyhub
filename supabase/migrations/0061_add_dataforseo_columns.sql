-- migrate:up
-- ===========================================
-- 0061_add_dataforseo_columns.sql
-- Add DataForSEO metric columns to keywords table
-- Moves data from extras JSONB into dedicated columns for better performance and queryability
-- ===========================================

-- Add DataForSEO metric columns to keywords table
alter table public.keywords
  add column if not exists search_volume integer,
  add column if not exists cpc numeric(10,2),
  add column if not exists dataforseo_competition numeric(5,4),
  add column if not exists monthly_trend jsonb;

-- Add indexes for common query patterns
create index if not exists keywords_search_volume_idx
  on public.keywords(search_volume desc nulls last);

create index if not exists keywords_cpc_idx
  on public.keywords(cpc desc nulls last);

create index if not exists keywords_dataforseo_competition_idx
  on public.keywords(dataforseo_competition nulls last);

-- Add GIN index for monthly_trend JSONB queries
create index if not exists keywords_monthly_trend_idx
  on public.keywords using gin(monthly_trend);

-- Add composite index for search by market + search volume (common filter)
create index if not exists keywords_market_volume_idx
  on public.keywords(market, search_volume desc nulls last);

-- Add comments
comment on column public.keywords.search_volume is 'Raw search volume from DataForSEO API';
comment on column public.keywords.cpc is 'Cost per click in USD from DataForSEO API';
comment on column public.keywords.dataforseo_competition is 'Raw competition score from DataForSEO (0-1 scale)';
comment on column public.keywords.monthly_trend is 'Monthly search trend data from DataForSEO: [{"year": 2024, "month": 11, "searches": 1300}, ...]';

-- migrate:down
drop index if exists public.keywords_market_volume_idx;
drop index if exists public.keywords_monthly_trend_idx;
drop index if exists public.keywords_dataforseo_competition_idx;
drop index if exists public.keywords_cpc_idx;
drop index if exists public.keywords_search_volume_idx;

alter table public.keywords
  drop column if exists monthly_trend,
  drop column if exists dataforseo_competition,
  drop column if exists cpc,
  drop column if exists search_volume;
