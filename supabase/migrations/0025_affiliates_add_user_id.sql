-- ===========================================
-- 0025_affiliates_add_user_id.sql
-- Add user_id to affiliates table for dashboard access
-- ===========================================

-- migrate:up

-- Add user_id column to link affiliates to user accounts
alter table public.affiliates
  add column if not exists user_id uuid references auth.users(id) on delete set null;

-- Add index for faster user lookups
create index if not exists affiliates_user_id_idx
  on public.affiliates(user_id);

-- Add affiliate metadata for dashboard display
alter table public.affiliates
  add column if not exists display_name text,
  add column if not exists email text,
  add column if not exists payout_method text default 'paypal',
  add column if not exists payout_email text;

comment on column public.affiliates.user_id is 'User account linked to this affiliate (for dashboard access)';
comment on column public.affiliates.display_name is 'Affiliate display name for dashboard';
comment on column public.affiliates.payout_method is 'Preferred payout method: paypal, stripe_connect, or manual';
comment on column public.affiliates.payout_email is 'Email or account ID for payouts';

-- migrate:down

drop index if exists affiliates_user_id_idx;

alter table public.affiliates
  drop column if exists payout_email,
  drop column if exists payout_method,
  drop column if exists email,
  drop column if exists display_name,
  drop column if exists user_id;
