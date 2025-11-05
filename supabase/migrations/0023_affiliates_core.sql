-- ===========================================
-- 0023_affiliates_core.sql
-- In-house affiliate program tables
-- ===========================================

-- migrate:up

create extension if not exists pgcrypto;

-- Affiliates: registered partners with commission rates
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'active',  -- active | paused | banned
  base_rate numeric(5,4) not null default 0.30,  -- e.g., 0.30 = 30%
  lifetime boolean not null default false,
  recur_months int not null default 12,  -- months to credit commissions
  cookie_days int not null default 90,
  min_payout_cents int not null default 2500,  -- $25 minimum
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.affiliates is 'Registered affiliate partners with commission rates and tracking rules.';
comment on column public.affiliates.base_rate is 'Commission rate as decimal (0.30 = 30%)';
comment on column public.affiliates.lifetime is 'If true, commissions apply forever; if false, expires after recur_months';
comment on column public.affiliates.cookie_days is 'Days to attribute clicks to this affiliate (default 90)';

-- Affiliate clicks: track visitor referrals
create table if not exists public.affiliate_clicks (
  id bigserial primary key,
  affiliate_id uuid references public.affiliates(id) on delete cascade,
  ref_code text not null,
  ts timestamptz not null default now(),
  ip inet,
  ua text,
  landing_path text,
  utm jsonb not null default '{}'::jsonb
);

comment on table public.affiliate_clicks is 'Tracks every click from an affiliate link with UTM parameters.';

create index if not exists affiliate_clicks_affiliate_idx
  on public.affiliate_clicks(affiliate_id, ts desc);

create index if not exists affiliate_clicks_ts_idx
  on public.affiliate_clicks(ts desc);

-- Affiliate referrals: user attribution
create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referred_user_id uuid unique not null,  -- one referral per user
  ref_code text not null,
  attributed_at timestamptz not null default now(),
  expires_at timestamptz  -- null if lifetime = true
);

comment on table public.affiliate_referrals is 'Maps referred users to affiliates. Expires_at determines commission window.';

create index if not exists affiliate_referrals_affiliate_idx
  on public.affiliate_referrals(affiliate_id, attributed_at desc);

create index if not exists affiliate_referrals_user_idx
  on public.affiliate_referrals(referred_user_id);

-- Commissions: invoice-based payouts
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referral_id uuid not null references public.affiliate_referrals(id) on delete cascade,
  stripe_invoice_id text unique not null,  -- ensures idempotency
  event_ts timestamptz not null,
  basis_cents int not null,  -- subtotal - discounts (excludes tax)
  rate numeric(5,4) not null,  -- rate applied
  amount_cents int not null,  -- commission amount
  status text not null default 'pending',  -- pending | reversed | paid
  reason text not null,  -- 'invoice_paid' | 'refund' | 'chargeback'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.commissions is 'Commission records tied to Stripe invoices. Unique on stripe_invoice_id for idempotency.';
comment on column public.commissions.basis_cents is 'Invoice subtotal minus discounts (excludes tax)';
comment on column public.commissions.status is 'pending = awaiting payout, paid = sent, reversed = refund/chargeback';

create index if not exists commissions_affiliate_idx
  on public.commissions(affiliate_id, created_at desc);

create index if not exists commissions_status_idx
  on public.commissions(status, created_at);

create index if not exists commissions_invoice_idx
  on public.commissions(stripe_invoice_id);

-- Payouts: batch payouts to affiliates
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_cents int not null,
  status text not null default 'ready',  -- ready | processing | sent
  method text not null,  -- 'paypal' | 'stripe_connect' | 'manual'
  destination text,  -- email or account ID
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

comment on table public.payouts is 'Batch payouts to affiliates. Aggregates multiple commissions.';

create index if not exists payouts_affiliate_idx
  on public.payouts(affiliate_id, created_at desc);

create index if not exists payouts_status_idx
  on public.payouts(status, created_at);

-- Payout items: many-to-many join
create table if not exists public.payout_items (
  payout_id uuid not null references public.payouts(id) on delete cascade,
  commission_id uuid not null references public.commissions(id) on delete cascade,
  primary key (payout_id, commission_id)
);

comment on table public.payout_items is 'Junction table linking payouts to individual commissions.';

create index if not exists payout_items_commission_idx
  on public.payout_items(commission_id);

-- migrate:down

drop index if exists payout_items_commission_idx;
drop table if exists public.payout_items cascade;

drop index if exists payouts_status_idx;
drop index if exists payouts_affiliate_idx;
drop table if exists public.payouts cascade;

drop index if exists commissions_invoice_idx;
drop index if exists commissions_status_idx;
drop index if exists commissions_affiliate_idx;
drop table if exists public.commissions cascade;

drop index if exists affiliate_referrals_user_idx;
drop index if exists affiliate_referrals_affiliate_idx;
drop table if exists public.affiliate_referrals cascade;

drop index if exists affiliate_clicks_ts_idx;
drop index if exists affiliate_clicks_affiliate_idx;
drop table if exists public.affiliate_clicks cascade;

drop table if exists public.affiliates cascade;
