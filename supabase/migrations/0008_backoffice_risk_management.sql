-- ===========================================
-- 0008_backoffice_risk_management.sql
-- ===========================================
-- migrate:up
create table if not exists public.risk_appetites (
    id uuid primary key default gen_random_uuid(),
    label text not null,
    category text,
    appetite_level text not null default 'balanced',
    owner text,
    tolerance jsonb default '{}'::jsonb,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists risk_appetites_label_idx
    on public.risk_appetites(lower(label));

create table if not exists public.risk_controls (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    owner text,
    status text not null default 'draft',
    coverage_area text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.risk_register_entries (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    summary text,
    status text not null default 'open',
    severity text not null default 'medium',
    likelihood text not null default 'possible',
    impact text not null default 'moderate',
    owner text,
    appetite_id uuid references public.risk_appetites(id) on delete set null,
    control_id uuid references public.risk_controls(id) on delete set null,
    mitigation text,
    follow_up text,
    raised_by text,
    raised_at timestamptz not null default now(),
    due_at timestamptz,
    resolved_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists risk_register_status_idx
    on public.risk_register_entries(status);

create index if not exists risk_register_appetite_idx
    on public.risk_register_entries(appetite_id);

create index if not exists risk_register_control_idx
    on public.risk_register_entries(control_id);

create table if not exists public.system_health_metrics (
    id uuid primary key default gen_random_uuid(),
    category text not null,
    metric_key text not null,
    metric_label text not null,
    metric_value numeric,
    metric_unit text,
    status text not null default 'ok',
    delta numeric,
    trend text,
    captured_at timestamptz not null default now(),
    extras jsonb default '{}'::jsonb
);

create unique index if not exists system_health_metrics_unique_idx
    on public.system_health_metrics(category, metric_key);

create index if not exists system_health_metrics_captured_idx
    on public.system_health_metrics(captured_at desc);

create table if not exists public.crawler_statuses (
    id uuid primary key default gen_random_uuid(),
    source text not null,
    status text not null default 'idle',
    last_run_at timestamptz,
    next_run_at timestamptz,
    total_records integer,
    error_message text,
    run_metadata jsonb default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

create unique index if not exists crawler_statuses_source_idx
    on public.crawler_statuses(lower(source));

comment on table public.risk_appetites is 'Defines organizational risk appetite statements and tolerances.';
comment on table public.risk_controls is 'Catalog of mitigating controls that can be linked to risk entries.';
comment on table public.risk_register_entries is 'Centralized risk register capturing raised risks and their lifecycle.';
comment on table public.system_health_metrics is 'Backoffice snapshot of key business and platform health metrics.';
comment on table public.crawler_statuses is 'Tracks scraping job health, throughput, and scheduling metadata.';

-- migrate:down
drop table if exists public.crawler_statuses cascade;
drop index if exists system_health_metrics_unique_idx;
drop index if exists system_health_metrics_captured_idx;
drop table if exists public.system_health_metrics cascade;
drop index if exists risk_register_status_idx;
drop index if exists risk_register_appetite_idx;
drop index if exists risk_register_control_idx;
drop table if exists public.risk_register_entries cascade;
drop table if exists public.risk_controls cascade;
drop index if exists risk_appetites_label_idx;
drop table if exists public.risk_appetites cascade;
