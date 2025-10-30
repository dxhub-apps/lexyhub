-- migrate:up
create table if not exists public.billing_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    stripe_subscription_id text not null,
    plan text not null,
    status text not null,
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean default false,
    canceled_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique(stripe_subscription_id)
);

create table if not exists public.billing_invoice_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid,
    stripe_invoice_id text not null,
    stripe_customer_id text,
    amount_due_cents bigint,
    amount_paid_cents bigint,
    status text,
    invoice_date timestamptz,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    unique(stripe_invoice_id)
);

create table if not exists public.api_keys (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    name text not null,
    hashed_key text not null,
    last_four text not null,
    status text not null default 'active',
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    revoked_at timestamptz,
    metadata jsonb default '{}'::jsonb,
    unique(user_id, name)
);

create table if not exists public.api_request_logs (
    id bigserial primary key,
    api_key_id uuid references public.api_keys(id) on delete set null,
    user_id uuid,
    route text not null,
    method text not null,
    status_code integer,
    tokens_prompt integer default 0,
    tokens_completion integer default 0,
    latency_ms integer,
    requested_at timestamptz not null default now(),
    metadata jsonb default '{}'::jsonb
);

create table if not exists public.plan_overrides (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    plan text not null,
    daily_query_limit integer,
    watchlist_limit integer,
    ai_suggestion_limit integer,
    momentum_multiplier numeric(6,3),
    notes text,
    created_at timestamptz not null default now(),
    expires_at timestamptz
);

create table if not exists public.webhook_events (
    id uuid primary key default gen_random_uuid(),
    provider text not null,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'pending',
    received_at timestamptz not null default now(),
    processed_at timestamptz,
    error_message text
);

comment on table public.billing_subscriptions is 'Stripe subscription linkage per user.';
comment on table public.billing_invoice_events is 'History of Stripe invoice events for auditing.';
comment on table public.api_keys is 'External developer API keys issued to users/partners.';
comment on table public.api_request_logs is 'Per-request logging with token usage for API calls.';
comment on table public.plan_overrides is 'Overrides for plan limits and multipliers.';
comment on table public.webhook_events is 'Inbound webhook receipts from Stripe and marketplaces.';

-- migrate:down
drop table if exists public.webhook_events cascade;
drop table if exists public.plan_overrides cascade;
drop table if exists public.api_request_logs cascade;
drop table if exists public.api_keys cascade;
drop table if exists public.billing_invoice_events cascade;
drop table if exists public.billing_subscriptions cascade;
