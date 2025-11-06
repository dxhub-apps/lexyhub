-- ===========================================
-- 0035_fix_profile_creation.sql
-- Fix ambiguous column error and add RPC for profile creation
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

-- RPC function to ensure user profile exists
create or replace function ensure_user_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_profile record;
begin
  -- Try to get existing profile
  select user_id, plan, momentum into v_profile
  from public.user_profiles
  where user_id = p_user_id;

  -- If profile exists, return it
  if found then
    return jsonb_build_object(
      'exists', true,
      'plan', v_profile.plan,
      'momentum', v_profile.momentum
    );
  end if;

  -- Create new profile with free plan
  insert into public.user_profiles (
    user_id,
    plan,
    momentum,
    ai_usage_quota,
    settings,
    created_at,
    updated_at
  ) values (
    p_user_id,
    'free',
    'new',
    0,
    '{}'::jsonb,
    now(),
    now()
  )
  on conflict (user_id) do nothing
  returning user_id, plan, momentum into v_profile;

  -- Return success
  return jsonb_build_object(
    'exists', false,
    'created', true,
    'plan', 'free',
    'momentum', 'new'
  );
end;
$$;

comment on function ensure_user_profile is 'Creates user profile if it does not exist. Can be called via RPC from application code.';

-- Grant execute permission to authenticated users
grant execute on function ensure_user_profile(uuid) to authenticated;

-- migrate:down

drop function if exists ensure_user_profile(uuid);

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
