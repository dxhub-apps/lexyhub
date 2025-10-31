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
begin
    if not exists (
        select 1
        from public.watchlists
        where user_id = new.user_id
          and name = 'Operational Watchlist'
    ) then
        insert into public.watchlists (user_id, name, description)
        values (new.user_id, 'Operational Watchlist', 'Automatically provisioned watchlist');
    end if;

    return new;
end;
$$;

drop trigger if exists user_profiles_default_watchlist on public.user_profiles;

create trigger user_profiles_default_watchlist
    after insert on public.user_profiles
    for each row
    execute function public.ensure_default_watchlist();

insert into public.watchlists (user_id, name, description)
select up.user_id, 'Operational Watchlist', 'Automatically provisioned watchlist'
from public.user_profiles up
where not exists (
    select 1
    from public.watchlists w
    where w.user_id = up.user_id
      and w.name = 'Operational Watchlist'
);

-- migrate:down
drop trigger if exists user_profiles_default_watchlist on public.user_profiles;
drop function if exists public.ensure_default_watchlist();

delete from public.data_providers where id = 'etsy';
