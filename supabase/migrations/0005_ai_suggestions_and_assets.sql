-- migrate:up
create table if not exists public.ai_suggestions (
    id uuid primary key default gen_random_uuid(),
    ai_prediction_id uuid references public.ai_predictions(id) on delete cascade,
    user_id uuid,
    keyword_id uuid references public.keywords(id) on delete cascade,
    listing_id uuid references public.listings(id) on delete cascade,
    suggestion_type text not null,
    payload jsonb not null,
    reasoning text,
    confidence numeric(6,3),
    model text,
    prompt_version text,
    created_at timestamptz not null default now(),
    extras jsonb default '{}'::jsonb
);

create index if not exists ai_suggestions_user_idx
    on public.ai_suggestions(user_id, created_at desc);

create table if not exists public.asset_uploads (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    listing_id uuid references public.listings(id) on delete cascade,
    bucket text not null,
    path text not null,
    mime_type text,
    size_bytes bigint,
    caption text,
    status text not null default 'stored',
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists asset_uploads_listing_idx
    on public.asset_uploads(listing_id, created_at desc);

comment on table public.ai_suggestions is 'Atomic AI suggestions derived from GPT pipelines.';
comment on table public.asset_uploads is 'Tracks media assets uploaded for AI analysis and tagging.';

-- migrate:down
drop index if exists asset_uploads_listing_idx;
drop table if exists public.asset_uploads cascade;
drop index if exists ai_suggestions_user_idx;
drop table if exists public.ai_suggestions cascade;
