-- Optional tables for roadmap services (`src/roadmap/*`). Apply after `schema.sql` when ready.

-- User-facing settings (sync from `settingsService.ts`)
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

-- Sponsorship *applications* — never replace public sponsor feed posts from the app directly.
create table if not exists public.sponsorship_submissions (
  id uuid primary key default uuid_generate_v4 (),
  submitter_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists sponsorship_submissions_submitter_idx
  on public.sponsorship_submissions (submitter_id, created_at desc);

alter table public.sponsorship_submissions enable row level security;

-- Expo push tokens (one active row per user for simple upsert from `notificationsService.ts`)
create table if not exists public.device_push_tokens (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);

alter table public.device_push_tokens enable row level security;

-- In-app notification rows (insert via Edge Function / trigger; client reads + marks read)
create table if not exists public.in_app_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists in_app_notifications_user_idx
  on public.in_app_notifications (user_id, created_at desc);

-- RLS for in_app_notifications is applied in rls_policies.sql (after policies exist).

-- Follow graph (requests optional for private accounts later)
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id != followee_id)
);

create index if not exists follows_followee_idx on public.follows (followee_id);

-- Enable RLS + policies when wiring follow UI (see rls_policies.sql).

create table if not exists public.follow_requests (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (requester_id, target_id),
  check (requester_id != target_id)
);

create index if not exists follow_requests_target_idx
  on public.follow_requests (target_id, created_at desc)
  where status = 'pending';

-- Example policies (adjust before production):
-- create policy "settings self" on public.user_settings for all using (auth.uid() = user_id);
-- create policy "sponsorship insert self" on public.sponsorship_submissions for insert with check (auth.uid() = submitter_id);
-- create policy "sponsorship read self" on public.sponsorship_submissions for select using (auth.uid() = submitter_id);
-- create policy "push tokens self" on public.device_push_tokens for all using (auth.uid() = user_id);
-- create policy "in_app_notif_select_own" on public.in_app_notifications for select using (auth.uid() = user_id);
-- create policy "in_app_notif_update_own" on public.in_app_notifications for update using (auth.uid() = user_id);
-- create policy "follows_select_authenticated" on public.follows for select using (auth.role() = 'authenticated');
-- create policy "follows_insert_self" on public.follows for insert with check (auth.uid() = follower_id);
-- create policy "follows_delete_self" on public.follows for delete using (auth.uid() = follower_id);
-- create policy "follow_req_select_parties" on public.follow_requests for select using (auth.uid() = requester_id or auth.uid() = target_id);
-- create policy "follow_req_insert_self" on public.follow_requests for insert with check (auth.uid() = requester_id);
