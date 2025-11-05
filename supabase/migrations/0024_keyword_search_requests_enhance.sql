-- migrate:up
-- ===========================================
-- 0024_keyword_search_requests_enhance.sql
-- Add RLS and indexes for telemetry
-- ===========================================

-- Add normalized query index
create index if not exists ksr_norm_market_idx
  on public.keyword_search_requests(normalized_query, market);

-- Enable RLS
alter table public.keyword_search_requests enable row level security;

-- Drop existing policies if they exist
drop policy if exists ksr_insert on public.keyword_search_requests;

-- Create insert policy for authenticated and service_role
create policy ksr_insert for insert on public.keyword_search_requests
  to authenticated, service_role
  using (true)
  with check (true);

-- migrate:down
drop policy if exists ksr_insert on public.keyword_search_requests;
alter table public.keyword_search_requests disable row level security;
drop index if exists ksr_norm_market_idx;
