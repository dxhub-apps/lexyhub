-- migrate:up
-- ===========================================
-- 0068_restore_plan_tier_cast_helper.sql
-- Reinstate plan-tier casting helper needed by lexy_rank_keywords
-- ===========================================

create or replace function public.lexy_cast_plan_tiers(p_tiers smallint[])
returns smallint[]
language sql
immutable
as $$
  with normalized as (
    select distinct greatest(0, least(2, coalesce(tier, 0)))::smallint as tier
    from unnest(coalesce(p_tiers, array[0,1,2]::smallint[])) as t(tier)
  )
  select case when count(*) = 0 then array[0,1,2]::smallint[] else array_agg(tier order by tier) end
  from normalized;
$$;

grant execute on function public.lexy_cast_plan_tiers(smallint[]) to anon, authenticated, service_role;

-- migrate:down
drop function if exists public.lexy_cast_plan_tiers(smallint[]);
