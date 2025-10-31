-- 0009_watchlist_listing_fk.sql
-- Ensure watchlist listing joins function for Supabase generated relationships.

-- migrate:up
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'watchlist_items_listing_fk'
  ) then
    alter table if exists public.watchlist_items
      add constraint watchlist_items_listing_fk
      foreign key (listing_id) references public.listings(id) on delete cascade;
  end if;
end
$$;

-- migrate:down
alter table if exists public.watchlist_items
  drop constraint if exists watchlist_items_listing_fk;
