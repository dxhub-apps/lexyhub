-- migrate:up
-- ===========================================
-- 0056_fix_ensure_user_profile_overload.sql
-- Fix function overloading issue with ensure_user_profile
-- ===========================================

-- Drop the old single-parameter version that's causing the overload conflict
drop function if exists public.ensure_user_profile(uuid);

-- Ensure the current two-parameter version exists and is correctly defined
-- This version was created in 0054 but the old version wasn't dropped
create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_signup_source text default 'web'
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_exists boolean;
  v_plan text;
  v_created boolean := false;
begin
  -- Check if profile exists
  select true, plan into v_exists, v_plan
  from public.user_profiles
  where user_id = p_user_id;

  if v_exists then
    return jsonb_build_object(
      'exists', true,
      'created', false,
      'plan', v_plan
    );
  end if;

  -- Determine initial plan based on signup source
  -- Extension users get Free+ with bonus quota
  v_plan := case
    when p_signup_source = 'extension' then 'free+'
    else 'free'
  end case;

  -- Create profile
  insert into public.user_profiles (
    user_id,
    plan,
    signup_source,
    momentum,
    ai_usage_quota
  ) values (
    p_user_id,
    v_plan,
    p_signup_source,
    'new',
    case when p_signup_source = 'extension' then 50 else 0 end -- Bonus quota for extension users
  )
  on conflict (user_id) do nothing;

  -- Check if insert was successful
  if found then
    v_created := true;
  end if;

  return jsonb_build_object(
    'exists', false,
    'created', v_created,
    'plan', v_plan
  );
end;
$$;

-- Update comment
comment on function public.ensure_user_profile(uuid, text) is
  'Creates user profile if it does not exist. Tracks signup source for extension users to grant bonus quota. Can be called via RPC from application code.';

-- Grant execute permission
grant execute on function public.ensure_user_profile(uuid, text) to authenticated, service_role;

-- migrate:down
-- Restore the old single-parameter version for rollback
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

grant execute on function ensure_user_profile(uuid) to authenticated;
