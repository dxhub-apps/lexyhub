-- migrate:up
create table if not exists public.data_providers (
    id text primary key,
    display_name text not null,
    provider_type text not null default 'marketplace',
    is_enabled boolean not null default true,
    max_freshness_seconds integer,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    provider_id text not null references public.data_providers(id),
    external_shop_id text not null,
    shop_name text,
    access_token text,
    refresh_token text,
    token_expires_at timestamptz,
    scopes text[],
    status text not null default 'active',
    last_synced_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(provider_id, external_shop_id)
);

create table if not exists public.provider_sync_states (
    id uuid primary key default gen_random_uuid(),
    marketplace_account_id uuid not null references public.marketplace_accounts(id) on delete cascade,
    sync_type text not null,
    cursor text,
    last_run_at timestamptz,
    next_run_at timestamptz,
    status text not null default 'idle',
    message text,
    metadata jsonb default '{}'::jsonb
);

create table if not exists public.listings (
    id uuid primary key default gen_random_uuid(),
    marketplace_account_id uuid not null references public.marketplace_accounts(id) on delete cascade,
    external_listing_id text not null,
    title text not null,
    description text,
    url text,
    currency text,
    price_cents integer,
    quantity integer,
    status text not null default 'active',
    published_at timestamptz,
    updated_at timestamptz not null default now(),
    extras jsonb default '{}'::jsonb,
    unique(marketplace_account_id, external_listing_id)
);

create table if not exists public.listing_tags (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid not null references public.listings(id) on delete cascade,
    tag text not null,
    source text not null default 'seller',
    created_at timestamptz not null default now(),
    unique(listing_id, tag)
);

create table if not exists public.listing_stats (
    id bigserial primary key,
    listing_id uuid not null references public.listings(id) on delete cascade,
    recorded_on date not null,
    views integer default 0,
    favorites integer default 0,
    orders integer default 0,
    revenue_cents bigint default 0,
    extras jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(listing_id, recorded_on)
);

create table if not exists public.ontology_nodes (
    id uuid primary key default gen_random_uuid(),
    lex_id text not null,
    label text not null,
    description text,
    parent_id uuid references public.ontology_nodes(id),
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(lex_id)
);

create table if not exists public.ontology_mappings (
    id uuid primary key default gen_random_uuid(),
    ontology_node_id uuid not null references public.ontology_nodes(id) on delete cascade,
    keyword_id uuid references public.keywords(id) on delete cascade,
    listing_id uuid references public.listings(id) on delete cascade,
    source text not null,
    confidence numeric(6,3),
    created_at timestamptz not null default now(),
    constraint ontology_mapping_target_ck check (
        (keyword_id is not null)::int + (listing_id is not null)::int >= 1
    )
);

alter table public.ai_predictions
    add constraint ai_predictions_listing_fk foreign key (listing_id) references public.listings(id) on delete set null;

comment on table public.data_providers is 'Registered external or synthetic data providers.';
comment on table public.marketplace_accounts is 'Connected seller accounts per provider.';
comment on table public.provider_sync_states is 'State tracking for incremental provider sync jobs.';
comment on table public.listings is 'Normalized listings synced from seller accounts.';
comment on table public.listing_tags is 'Tags associated with listings, including AI suggestions.';
comment on table public.listing_stats is 'Daily performance metrics for listings.';
comment on table public.ontology_nodes is 'Canonical Lexy ontology nodes for commerce concepts.';
comment on table public.ontology_mappings is 'Mappings between ontology nodes and keywords/listings.';

-- migrate:down
alter table if exists public.ai_predictions drop constraint if exists ai_predictions_listing_fk;
drop table if exists public.ontology_mappings cascade;
drop table if exists public.ontology_nodes cascade;
drop table if exists public.listing_stats cascade;
drop table if exists public.listing_tags cascade;
drop table if exists public.listings cascade;
drop table if exists public.provider_sync_states cascade;
drop table if exists public.marketplace_accounts cascade;
drop table if exists public.data_providers cascade;
