-- User reports on community posts (moderation queue).
-- Review in Supabase Table Editor or via service role; extend RLS when you add a moderator role claim.

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','misinformation','copyright','other')),
  details text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolver_note text
);

create index if not exists post_reports_post_id_idx on public.post_reports (post_id);
create index if not exists post_reports_reporter_idx on public.post_reports (reporter_id);
create index if not exists post_reports_status_created_idx on public.post_reports (status, created_at desc);

alter table public.post_reports enable row level security;

drop policy if exists "post_reports_insert_authenticated" on public.post_reports;
create policy "post_reports_insert_authenticated"
  on public.post_reports for insert
  with check (
    auth.uid() is not null
    and auth.uid() = reporter_id
  );

drop policy if exists "post_reports_select_own" on public.post_reports;
create policy "post_reports_select_own"
  on public.post_reports for select
  using (auth.uid() = reporter_id);
