-- migrate:up
-- ===========================================
-- 0025_keyword_seeds_enhance.sql
-- Enhance keyword_seeds with generated column and RLS
-- ===========================================

-- Add source_hint and notes if not exists
alter table public.keyword_seeds
  add column if not exists source_hint text,
  add column if not exists notes text;

-- Recreate as stored generated column if it's not already
-- First check if term_normalized exists and drop it if not generated
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'keyword_seeds'
      and column_name = 'term_normalized'
      and is_generated = 'NEVER'
  ) then
    alter table public.keyword_seeds drop column term_normalized;
  end if;
end $$;

-- Add as generated column
alter table public.keyword_seeds
  add column if not exists term_normalized text generated always as (public.lexy_normalize_keyword(term)) stored;

-- Create unique index if not exists
drop index if exists keyword_seeds_uk;
create unique index keyword_seeds_uk on public.keyword_seeds(term_normalized, market);

-- Enable RLS
alter table public.keyword_seeds enable row level security;

-- Drop existing policies if they exist
drop policy if exists keyword_seeds_read on public.keyword_seeds;
drop policy if exists keyword_seeds_write on public.keyword_seeds;

-- Create policies
create policy keyword_seeds_read on public.keyword_seeds
  for select
  to authenticated, service_role
  using (true);

create policy keyword_seeds_write on public.keyword_seeds
  for all
  to service_role
  using (true)
  with check (true);

-- migrate:down
drop policy if exists keyword_seeds_write on public.keyword_seeds;
drop policy if exists keyword_seeds_read on public.keyword_seeds;
alter table public.keyword_seeds disable row level security;
