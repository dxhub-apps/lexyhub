-- migrate:up
insert into public.data_providers (id, display_name, provider_type, is_enabled, max_freshness_seconds, updated_at)
values (
    'etsy',
    'Etsy Marketplace',
    'marketplace',
    true,
    86400,
    now()
)
on conflict (id) do update
set
    display_name = excluded.display_name,
    provider_type = excluded.provider_type,
    is_enabled = excluded.is_enabled,
    max_freshness_seconds = excluded.max_freshness_seconds,
    updated_at = now();

create or replace function public.ensure_default_watchlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    base_plan text;
    override_plan text;
    override_capacity integer;
    resolved_plan text;
    resolved_capacity integer;
begin
    select plan into base_plan
    from public.user_profiles
    where user_id = new.user_id;

    select po.plan, po.watchlist_item_capacity
    into override_plan, override_capacity
    from public.plan_overrides po
    where po.user_id = new.user_id
    order by po.created_at desc
    limit 1;

    resolved_plan := coalesce(
        nullif(lower(trim(override_plan)), ''),
        nullif(lower(trim(base_plan)), ''),
        'free'
    );

    if resolved_plan not in ('growth', 'scale') then
        resolved_plan := 'free';
    end if;

    resolved_capacity := coalesce(
        override_capacity,
        case resolved_plan
            when 'growth' then 75
            when 'scale' then 150
            else 25
        end
    );

    if not exists (
        select 1
        from public.watchlists
        where user_id = new.user_id
          and name = 'Operational Watchlist'
    ) then
        insert into public.watchlists (user_id, name, description, capacity)
        values (
            new.user_id,
            'Operational Watchlist',
            'Automatically provisioned watchlist',
            resolved_capacity
        );
    end if;

    return new;
end;
$$;

drop trigger if exists user_profiles_default_watchlist on public.user_profiles;

create trigger user_profiles_default_watchlist
    after insert on public.user_profiles
    for each row
    execute function public.ensure_default_watchlist();

with resolved as (
    select
        up.user_id,
        coalesce(
            nullif(lower(trim(po.plan)), ''),
            nullif(lower(trim(up.plan)), ''),
            'free'
        ) as resolved_plan,
        po.watchlist_item_capacity
    from public.user_profiles up
    left join lateral (
        select plan, watchlist_item_capacity
        from public.plan_overrides
        where user_id = up.user_id
        order by created_at desc
        limit 1
    ) po on true
)
insert into public.watchlists (user_id, name, description, capacity)
select r.user_id,
       'Operational Watchlist',
       'Automatically provisioned watchlist',
       coalesce(
           r.watchlist_item_capacity,
           case r.resolved_plan
               when 'growth' then 75
               when 'scale' then 150
               else 25
           end
       )
from resolved r
where not exists (
    select 1
    from public.watchlists w
    where w.user_id = r.user_id
      and w.name = 'Operational Watchlist'
);

-- migrate:down
drop trigger if exists user_profiles_default_watchlist on public.user_profiles;
drop function if exists public.ensure_default_watchlist();

delete from public.data_providers where id = 'etsy';
