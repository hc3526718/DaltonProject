-- Allow authors to delete their own posts.
-- `user_feed_hides` was used for "hide from feed" (retired in the app). Apply `004_drop_user_feed_hides.sql` to remove that table if present.
-- Run in Supabase SQL Editor after previous RLS migrations.

alter table public.posts enable row level security;

drop policy if exists "posts_delete_author" on public.posts;
create policy "posts_delete_author"
  on public.posts for delete
  using (auth.uid() = author_id);

create table if not exists public.user_feed_hides (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists user_feed_hides_user_idx on public.user_feed_hides (user_id);

alter table public.user_feed_hides enable row level security;

drop policy if exists "user_feed_hides_select_own" on public.user_feed_hides;
create policy "user_feed_hides_select_own"
  on public.user_feed_hides for select
  using (auth.uid() = user_id);

drop policy if exists "user_feed_hides_insert_own" on public.user_feed_hides;
create policy "user_feed_hides_insert_own"
  on public.user_feed_hides for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_feed_hides_delete_own" on public.user_feed_hides;
create policy "user_feed_hides_delete_own"
  on public.user_feed_hides for delete
  using (auth.uid() = user_id);
