-- migrate:up
-- Seed common marketplace providers for dynamic dropdown usage

-- Etsy is already seeded in 0007_watchlists_defaults_and_provider.sql
-- This migration adds additional common marketplaces

insert into public.data_providers (id, display_name, provider_type, is_enabled, max_freshness_seconds, updated_at)
values
    ('amazon', 'Amazon', 'marketplace', true, 86400, now()),
    ('ebay', 'eBay', 'marketplace', true, 86400, now()),
    ('shopify', 'Shopify', 'marketplace', true, 86400, now()),
    ('walmart', 'Walmart Marketplace', 'marketplace', true, 86400, now()),
    ('aliexpress', 'AliExpress', 'marketplace', true, 86400, now()),
    ('mercari', 'Mercari', 'marketplace', true, 86400, now()),
    ('poshmark', 'Poshmark', 'marketplace', true, 86400, now()),
    ('depop', 'Depop', 'marketplace', true, 86400, now())
on conflict (id) do update
set
    display_name = excluded.display_name,
    provider_type = excluded.provider_type,
    is_enabled = excluded.is_enabled,
    max_freshness_seconds = excluded.max_freshness_seconds,
    updated_at = now();

comment on table public.data_providers is 'Data providers including marketplaces and synthetic sources. Used for dynamic dropdowns and data source configuration.';

-- migrate:down
delete from public.data_providers
where id in ('amazon', 'ebay', 'shopify', 'walmart', 'aliexpress', 'mercari', 'poshmark', 'depop');
