-- ===========================================
-- 0035_fix_profile_creation.sql
-- Fix ambiguous column error and ensure profiles are created
-- ===========================================

-- migrate:up

-- Fix the ambiguous column reference in generate_affiliate_code function
create or replace function generate_affiliate_code()
returns text
language plpgsql
as $$
declare
  new_code text;
  code_exists boolean;
begin
  loop
    -- Generate 8 random uppercase alphanumeric characters
    new_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

    -- Check if code already exists (using explicit variable names to avoid ambiguity)
    select exists(
      select 1 from public.affiliates where code = new_code
    ) into code_exists;

    -- If code doesn't exist, return it
    if not code_exists then
      return new_code;
    end if;
  end loop;
end;
$$;

comment on function generate_affiliate_code is 'Generates a unique 8-character uppercase alphanumeric affiliate code (fixed ambiguous column reference)';

-- Function to auto-create user profile when a user signs up
create or replace function auto_create_user_profile()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Create user profile with free plan
  insert into public.user_profiles (
    user_id,
    plan,
    momentum,
    ai_usage_quota,
    settings,
    created_at,
    updated_at
  ) values (
    NEW.id,
    'free',
    'new',
    0,
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  return NEW;
end;
$$;

comment on function auto_create_user_profile is 'Trigger function to create user profile when user signs up in auth.users';

-- Create trigger on auth.users insert
drop trigger if exists trigger_auto_create_user_profile on auth.users;
create trigger trigger_auto_create_user_profile
  after insert on auth.users
  for each row
  execute function auto_create_user_profile();

comment on trigger trigger_auto_create_user_profile on auth.users is 'Automatically creates a user profile when a new user signs up';

-- migrate:down

drop trigger if exists trigger_auto_create_user_profile on auth.users;
drop function if exists auto_create_user_profile;

-- Restore original generate_affiliate_code function (with the bug)
create or replace function generate_affiliate_code()
returns text
language plpgsql
as $$
declare
  code text;
  exists boolean;
begin
  loop
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    select exists(select 1 from public.affiliates where public.affiliates.code = code) into exists;
    if not exists then
      return code;
    end if;
  end loop;
end;
$$;
