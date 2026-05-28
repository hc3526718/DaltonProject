-- Unique public usernames on profiles (nullable until onboarding completes).
-- Lowercase enforced by the app; index treats stored value as canonical.

alter table public.profiles add column if not exists username text;

drop index if exists profiles_username_unique_idx;

create unique index profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;
