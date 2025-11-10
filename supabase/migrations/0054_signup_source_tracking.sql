-- migrate:up
-- ===========================================
-- 0054_signup_source_tracking.sql
-- Add signup_source tracking for extension users
-- ===========================================

-- Add signup_source column to user_profiles
alter table public.user_profiles
  add column if not exists signup_source text default 'web';

-- Create index for analytics
create index if not exists user_profiles_signup_source_idx
  on public.user_profiles(signup_source);

-- Comment
comment on column public.user_profiles.signup_source is 'Source of user signup (web, extension, mobile, api, etc). Used for acquisition tracking and bonus quota allocation.';

-- Update the ensure_user_profile RPC to accept signup_source parameter
create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_signup_source text default 'web'
)
returns jsonb
language plpgsql
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

-- Grant execute permission
grant execute on function public.ensure_user_profile(uuid, text) to authenticated, service_role;

-- migrate:down
drop function if exists public.ensure_user_profile(uuid, text);

drop index if exists user_profiles_signup_source_idx;

alter table public.user_profiles
  drop column if exists signup_source;
