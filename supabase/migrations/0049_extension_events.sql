-- migrate:up
-- ===========================================
-- 0049_extension_events.sql
-- Extension event tracking for v4
-- ===========================================

-- Create extension_events table for deterministic event aggregation
create table if not exists public.extension_events (
    id bigserial primary key,
    user_id uuid not null,
    event_type text not null,
    marketplace text,
    keyword_id uuid references public.keywords(id) on delete set null,
    url text,
    source text not null default 'extension',
    occurred_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb
);

-- Create indexes for efficient querying
create index if not exists extension_events_user_idx
    on public.extension_events(user_id, occurred_at desc);

create index if not exists extension_events_type_idx
    on public.extension_events(event_type, occurred_at desc);

create index if not exists extension_events_keyword_idx
    on public.extension_events(keyword_id, occurred_at desc);

create index if not exists extension_events_marketplace_idx
    on public.extension_events(marketplace, occurred_at desc);

-- Comment
comment on table public.extension_events is 'Structured events from Chrome Extension v4 for deterministic aggregation and ai_corpus enrichment. No PII, public data only.';

-- Grant permissions
grant select, insert on public.extension_events to authenticated, service_role;

-- migrate:down
drop table if exists public.extension_events cascade;
