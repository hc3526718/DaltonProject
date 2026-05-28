-- In-app proposals for media / sponsor / event intake (moderator review).

create table if not exists public.content_proposals (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('media', 'sponsor', 'event')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'needs_info')),
  payload jsonb not null default '{}'::jsonb,
  attachment_urls text[] not null default '{}',
  reviewer_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_proposals_author_idx on public.content_proposals (author_id);
create index if not exists content_proposals_status_idx on public.content_proposals (status);

alter table public.content_proposals enable row level security;

drop policy if exists "content_proposals_select_own" on public.content_proposals;
create policy "content_proposals_select_own"
  on public.content_proposals for select
  using (auth.uid() = author_id);

drop policy if exists "content_proposals_insert_own" on public.content_proposals;
create policy "content_proposals_insert_own"
  on public.content_proposals for insert
  with check (auth.uid() = author_id);

-- Updates/deletes: service role / moderator only (no client UPDATE for members).
