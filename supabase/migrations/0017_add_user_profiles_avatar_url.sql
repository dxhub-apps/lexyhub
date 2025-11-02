-- migrate:up
alter table public.user_profiles
  add column if not exists avatar_url text;

update public.user_profiles
set avatar_url = coalesce(settings -> 'profile' ->> 'avatarUrl', avatar_url)
where (settings -> 'profile' ->> 'avatarUrl') is not null
  and coalesce(avatar_url, '') = '';

comment on column public.user_profiles.avatar_url is 'Public URL for the user avatar stored in Vercel Blob.';

-- migrate:down
alter table public.user_profiles
  drop column if exists avatar_url;
