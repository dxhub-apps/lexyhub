-- ===========================================
-- 0026_auto_create_affiliate.sql
-- Automatically create affiliate record when user signs up
-- ===========================================

-- migrate:up

-- Function to generate a random affiliate code (8 uppercase alphanumeric characters)
create or replace function generate_affiliate_code()
returns text
language plpgsql
as $$
declare
  code text;
  exists boolean;
begin
  loop
    -- Generate 8 random uppercase alphanumeric characters
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Check if code already exists
    select exists(select 1 from public.affiliates where public.affiliates.code = code) into exists;

    -- If code doesn't exist, return it
    if not exists then
      return code;
    end if;
  end loop;
end;
$$;

comment on function generate_affiliate_code is 'Generates a unique 8-character uppercase alphanumeric affiliate code';

-- Function to automatically create affiliate record when user_profile is created
create or replace function auto_create_affiliate()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Create affiliate record with random code
  insert into public.affiliates (
    code,
    user_id,
    status,
    base_rate,
    lifetime,
    recur_months,
    cookie_days,
    min_payout_cents
  ) values (
    generate_affiliate_code(),
    NEW.user_id,
    'active',
    0.30,  -- 30% default commission
    false,
    12,    -- 12 months default
    90,    -- 90 days cookie
    2500   -- $25 minimum payout
  );

  return NEW;
end;
$$;

comment on function auto_create_affiliate is 'Trigger function to create affiliate record when user_profile is inserted';

-- Create trigger on user_profiles insert
drop trigger if exists trigger_auto_create_affiliate on public.user_profiles;
create trigger trigger_auto_create_affiliate
  after insert on public.user_profiles
  for each row
  execute function auto_create_affiliate();

comment on trigger trigger_auto_create_affiliate on public.user_profiles is 'Automatically creates an affiliate record when a new user signs up';

-- migrate:down

drop trigger if exists trigger_auto_create_affiliate on public.user_profiles;
drop function if exists auto_create_affiliate;
drop function if exists generate_affiliate_code;
