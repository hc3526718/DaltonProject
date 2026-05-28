-- Master controller (profiles.master_control), partner subscription pages, RLS hardening.
-- Idempotent where possible.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists master_control text not null default 'no'
    check (master_control in ('yes', 'no'));

alter table public.profiles
  add column if not exists master_pin_hash text;

-- Partner / subscription showcase pages (curated by master only).
create table if not exists public.subscription_offer_pages (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  business_name text not null,
  description text,
  hero_image_url text,
  video_url text,
  website_url text,
  social_links jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_offer_pages_sort_idx
  on public.subscription_offer_pages (sort_order asc, created_at desc);

alter table public.subscription_offer_pages enable row level security;

drop policy if exists "subscription_offer_pages_select_authenticated" on public.subscription_offer_pages;
create policy "subscription_offer_pages_select_authenticated"
  on public.subscription_offer_pages for select
  using (auth.role() = 'authenticated');

drop policy if exists "subscription_offer_pages_insert_master" on public.subscription_offer_pages;
create policy "subscription_offer_pages_insert_master"
  on public.subscription_offer_pages for insert
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

drop policy if exists "subscription_offer_pages_update_master" on public.subscription_offer_pages;
create policy "subscription_offer_pages_update_master"
  on public.subscription_offer_pages for update
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

drop policy if exists "subscription_offer_pages_delete_master" on public.subscription_offer_pages;
create policy "subscription_offer_pages_delete_master"
  on public.subscription_offer_pages for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

-- Tighten events: created_by must match inserter; allow update/delete by owner or master.
drop policy if exists "events_insert_authenticated" on public.events;
create policy "events_insert_authenticated"
  on public.events for insert
  with check (
    auth.role() = 'authenticated'
    and created_by is not null
    and created_by = auth.uid()
  );

drop policy if exists "events_update_owner_or_master" on public.events;
create policy "events_update_owner_or_master"
  on public.events for update
  using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  )
  with check (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

drop policy if exists "events_delete_owner_or_master" on public.events;
create policy "events_delete_owner_or_master"
  on public.events for delete
  using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

-- Master may delete any community post (in addition to author policy).
drop policy if exists "posts_delete_master" on public.posts;
create policy "posts_delete_master"
  on public.posts for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

-- Master may delete any media row (in addition to owner ALL policy).
drop policy if exists "media_assets_delete_master" on public.media_assets;
create policy "media_assets_delete_master"
  on public.media_assets for delete
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.master_control = 'yes')
  );

-- Master PIN helpers (hash only; never store raw PIN).
create or replace function public.set_master_pin(pin text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and master_control = 'yes') then
    raise exception 'not_master';
  end if;
  if pin is null or length(trim(pin)) <> 6 or trim(pin) !~ '^\d{6}$' then
    raise exception 'invalid_pin';
  end if;
  update profiles
  set master_pin_hash = encode(
    digest(trim(pin) || auth.uid()::text || 'dalton_master_v1', 'sha256'),
    'hex'
  )
  where id = auth.uid();
end;
$fn$;

create or replace function public.verify_master_pin(pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  h text;
  expected text;
begin
  if auth.uid() is null then
    return false;
  end if;
  if not exists (select 1 from profiles where id = auth.uid() and master_control = 'yes') then
    return false;
  end if;
  select master_pin_hash into h from profiles where id = auth.uid();
  if h is null or pin is null or length(trim(pin)) <> 6 then
    return false;
  end if;
  expected := encode(
    digest(trim(pin) || auth.uid()::text || 'dalton_master_v1', 'sha256'),
    'hex'
  );
  return h = expected;
end;
$fn$;

revoke all on function public.set_master_pin(text) from public;
revoke all on function public.verify_master_pin(text) from public;
grant execute on function public.set_master_pin(text) to authenticated;
grant execute on function public.verify_master_pin(text) to authenticated;

-- Grant master flag to designated account (must exist in auth.users).
update public.profiles p
set master_control = 'yes'
from auth.users u
where p.id = u.id
  and lower(coalesce(u.email, '')) = lower('haydncampbell22@gmail.com');
