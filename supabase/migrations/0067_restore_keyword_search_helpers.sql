-- migrate:up
-- ===========================================
-- 0067_restore_keyword_search_helpers.sql
-- Ensure helper casts referenced by keyword RPCs exist in every environment
-- ===========================================

create or replace function public.lexy_cast_sources(p_sources text[])
returns text[]
language sql
immutable
as $$
  with cleaned as (
    select lower(btrim(s)) as src
    from unnest(coalesce(p_sources, array[]::text[])) as t(s)
    where s is not null
      and btrim(s) <> ''
  )
  select case when count(*) = 0 then null else array_agg(distinct src) end
  from cleaned;
$$;

grant execute on function public.lexy_cast_sources(text[]) to anon, authenticated, service_role;

-- migrate:down
drop function if exists public.lexy_cast_sources(text[]);
