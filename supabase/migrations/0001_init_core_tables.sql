-- migrate:up
create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.keyword_seeds (
    id uuid primary key default gen_random_uuid(),
    term text not null,
    market text not null,
    priority integer not null default 0,
    status text not null default 'pending',
    last_run_at timestamptz,
    next_run_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.keywords (
    id uuid primary key default gen_random_uuid(),
    term text not null,
    source text not null,
    market text not null,
    tier text not null default 'free',
    is_seed boolean not null default false,
    parent_seed_id uuid references public.keyword_seeds(id),
    demand_index numeric(6,3),
    competition_score numeric(6,3),
    engagement_score numeric(6,3),
    ai_opportunity_score numeric(6,3),
    trend_momentum numeric(6,3),
    freshness_ts timestamptz,
    extras jsonb default '{}'::jsonb,
    source_reason text,
    method text,
    provenance_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.keywords
    add constraint keywords_term_source_unique unique(term, source, market);

create table if not exists public.embeddings (
    term_hash text primary key,
    term text not null,
    embedding vector(3072) not null,
    model text not null,
    created_at timestamptz not null default now()
);

-- simple btree index is OK
create index if not exists embeddings_term_idx on public.embeddings(term);

-- NOTE:
-- we do NOT create an ANN index (ivfflat/hnsw) here
-- because current pgvector on this instance rejects >2000 dims for those methods.
-- Nearest-neighbor queries must be brute-force, e.g.:
--   select * from public.embeddings
--   order by embedding <-> $1
--   limit 50;

create table if not exists public.concept_clusters (
    id uuid primary key default gen_random_uuid(),
    centroid_vector vector(3072) not null,
    label text,
    description text,
    members text[] default array[]::text[],
    extras jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- same note: no ANN index on centroid_vector because of 3072 dims

create table if not exists public.trend_series (
    id bigserial primary key,
    term text not null,
    source text not null,
    recorded_on date not null,
    trend_score numeric(10,4),
    velocity numeric(10,4),
    expected_growth_30d numeric(10,4),
    extras jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists trend_series_term_source_date_idx
    on public.trend_series(term, source, recorded_on);

create table if not exists public.ai_predictions (
    id uuid primary key default gen_random_uuid(),
    listing_id uuid,
    keyword_id uuid references public.keywords(id),
    user_id uuid,
    scenario_input jsonb not null,
    result jsonb,
    predicted_visibility numeric(10,4),
    predicted_engagement numeric(10,4),
    confidence numeric(6,3),
    model text,
    prompt_version text,
    tokens_prompt integer,
    tokens_completion integer,
    extras jsonb default '{}'::jsonb,
    source text default 'ai',
    method text,
    provenance_id text,
    created_at timestamptz not null default now()
);

create index if not exists ai_predictions_user_idx
    on public.ai_predictions(user_id, created_at desc);

create table if not exists public.user_profiles (
    user_id uuid primary key,
    plan text not null default 'free',
    momentum text not null default 'new',
    stripe_customer_id text,
    ai_usage_quota integer not null default 0,
    settings jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.keywords is 'Normalized keywords from all sources with AI metrics.';
comment on table public.embeddings is 'Cache of term embeddings using pgvector.';
comment on table public.concept_clusters is 'Semantic clusters labelled via GPT.';
comment on table public.trend_series is 'Daily trend metrics aggregated from multiple sources.';
comment on table public.ai_predictions is 'AI-generated predictions, suggestions, and explanations.';
comment on table public.keyword_seeds is 'Seed terms queued for enrichment and expansion.';
comment on table public.user_profiles is 'Per-user plan, quota, and personalization metadata.';

-- migrate:down
alter table if exists public.keywords drop constraint if exists keywords_term_source_unique;

drop table if exists public.user_profiles cascade;
drop table if exists public.ai_predictions cascade;
drop table if exists public.trend_series cascade;
drop table if exists public.concept_clusters cascade;

-- indexes and table for embeddings
drop index if exists embeddings_term_idx;
-- no ANN index to drop, but drop defensively:
drop index if exists embeddings_vector_idx;
drop index if exists embeddings_vector_hnsw_idx;
drop table if exists public.embeddings cascade;

drop table if exists public.keywords cascade;
drop table if exists public.keyword_seeds cascade;
