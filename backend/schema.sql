-- Dalton — Postgres schema (Supabase-compatible).
-- Apply via Supabase SQL editor or `supabase db push`. Tune RLS policies per product.

-- Extensions
create extension if not exists "uuid-ossp";

-- Organizations (multi-tenant)
create table if not exists public.organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Memberships + capability-backed roles (enum is idempotent for re-running this file).
do $$
begin
  create type public.app_role as enum ('member', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organization_memberships (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role app_role not null default 'member',
  capabilities jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Media metadata (binary in Storage / S3)
do $$
begin
  create type public.media_kind as enum ('image', 'video', 'audio', 'file');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.media_assets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  kind media_kind not null,
  storage_path text not null,
  public_url text,
  thumbnail_url text,
  mime_type text,
  byte_size bigint,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  post_id uuid,
  message_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists media_assets_owner_idx on public.media_assets (owner_id);
create index if not exists media_assets_post_idx on public.media_assets (post_id);

-- Posts
create table if not exists public.posts (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_author_idx on public.posts (author_id);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.post_reactions (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (post_id, user_id, emoji)
);

create table if not exists public.post_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at desc);

-- Messages (DM or thread)
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  media_asset_id uuid references public.media_assets (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conv_idx on public.messages (conversation_id, created_at desc);

-- Events & bookings
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references public.organizations (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text,
  hero_image_url text,
  requires_payment boolean not null default false,
  stripe_price_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reference text not null unique,
  payment_status text default 'unpaid' check (payment_status in ('unpaid', 'pending', 'paid', 'refunded')),
  stripe_checkout_session_id text,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bookings_user_idx on public.bookings (user_id);

-- Subscriptions (RevenueCat / Store webhook mirror — server truth)
create table if not exists public.subscription_state (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  is_pro boolean not null default false,
  entitlement_ids text[] default array[]::text[],
  updated_at timestamptz not null default now(),
  raw jsonb
);

-- Profile extensions (safe re-run on existing DBs; validate enums in app / later CHECK)
alter table public.profiles add column if not exists allow_messages_from text default 'everyone';
alter table public.profiles add column if not exists dalton_verified boolean default false;
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists persona_role text;
alter table public.profiles add column if not exists sports text[] not null default '{}';
alter table public.profiles add column if not exists discovery_source text;
alter table public.profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists primary_sport text;
alter table public.profiles add column if not exists highlights jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists recent_results jsonb not null default '[]'::jsonb;
create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

-- RLS: policies live in backend/rls_policies.sql (run after this file + handle_new_user.sql).
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.messages enable row level security;
alter table public.media_assets enable row level security;
alter table public.bookings enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;

-- Example policy pattern (uncomment & adjust):
-- create policy "read own profile" on public.profiles for select using (auth.uid() = id);
