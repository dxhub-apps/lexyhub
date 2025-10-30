-- migrate:up
create table if not exists public.keyword_ai_insights (
    cache_key text primary key,
    query text not null,
    market text not null,
    source text not null,
    summary text not null,
    model text not null,
    generated_at timestamptz not null,
    context jsonb not null
);

comment on table public.keyword_ai_insights is 'Caches AI-generated keyword insight summaries to avoid repeated OpenAI calls.';

-- migrate:down
drop table if exists public.keyword_ai_insights cascade;
