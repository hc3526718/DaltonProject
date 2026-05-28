-- Dalton — Row Level Security policies (run AFTER schema.sql + handle_new_user.sql).
-- In Supabase: SQL Editor → paste → Run. Re-run is safe: uses DROP POLICY IF EXISTS where needed.
--
-- Verify trigger: Dashboard → Database → Triggers → `on_auth_user_created` on `auth.users`.
-- Verify profiles: Authentication → Users → sign up test user → Table Editor → public.profiles row exists.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- Signed-in users can read any profile row (feeds / avatars). Tighten later (blocked users, private accounts).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Optional if client ever inserts (trigger normally creates the row). Safe no-op if unused.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- posts (public read MVP; only author inserts)
-- ---------------------------------------------------------------------------
drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
  on public.posts for select
  using (true);

drop policy if exists "posts_insert_author" on public.posts;
create policy "posts_insert_author"
  on public.posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "posts_update_author" on public.posts;
create policy "posts_update_author"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- post_likes / post_reactions / post_comments
-- ---------------------------------------------------------------------------
drop policy if exists "post_likes_select" on public.post_likes;
create policy "post_likes_select" on public.post_likes for select using (true);

drop policy if exists "post_likes_insert" on public.post_likes;
create policy "post_likes_insert" on public.post_likes for insert with check (auth.uid() = user_id);

drop policy if exists "post_likes_delete" on public.post_likes;
create policy "post_likes_delete" on public.post_likes for delete using (auth.uid() = user_id);

drop policy if exists "post_reactions_select" on public.post_reactions;
create policy "post_reactions_select" on public.post_reactions for select using (true);

drop policy if exists "post_reactions_insert" on public.post_reactions;
create policy "post_reactions_insert" on public.post_reactions for insert with check (auth.uid() = user_id);

drop policy if exists "post_reactions_delete" on public.post_reactions;
create policy "post_reactions_delete" on public.post_reactions for delete using (auth.uid() = user_id);

drop policy if exists "post_comments_select" on public.post_comments;
create policy "post_comments_select"
  on public.post_comments for select
  using (true);

drop policy if exists "post_comments_insert" on public.post_comments;
create policy "post_comments_insert"
  on public.post_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own"
  on public.post_comments for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- ---------------------------------------------------------------------------
-- conversations + participants (pair with rpc_get_or_create_dm.sql)
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

drop policy if exists "conv_select_member" on public.conversations;
create policy "conv_select_member"
  on public.conversations for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "cp_select_member" on public.conversation_participants;
create policy "cp_select_member"
  on public.conversation_participants for select
  using (
    exists (
      select 1 from public.conversation_participants me
      where me.conversation_id = conversation_participants.conversation_id
      and me.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- messages (only members of the conversation)
-- ---------------------------------------------------------------------------
drop policy if exists "messages_select_authenticated" on public.messages;
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
    )
  );

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id
      and cp.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- media_assets, bookings — owner / self patterns
-- ---------------------------------------------------------------------------
drop policy if exists "media_owner_all" on public.media_assets;
create policy "media_owner_all"
  on public.media_assets for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "bookings_self_all" on public.bookings;
create policy "bookings_self_all"
  on public.bookings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- events (browse all; any signed-in user may create — tighten to hosts later)
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;

drop policy if exists "events_select_all" on public.events;
create policy "events_select_all"
  on public.events for select
  using (true);

drop policy if exists "events_insert_authenticated" on public.events;
create policy "events_insert_authenticated"
  on public.events for insert
  with check (auth.role() = 'authenticated');

-- Optional hardening (run AFTER adding `events.created_by`):
-- drop policy if exists "events_insert_authenticated" on public.events;
-- create policy "events_insert_authenticated"
--   on public.events for insert
--   with check (auth.role() = 'authenticated' and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- in_app_notifications (requires `roadmap_extensions.sql` table)
-- ---------------------------------------------------------------------------
alter table public.in_app_notifications enable row level security;

drop policy if exists "in_app_notif_select_own" on public.in_app_notifications;
create policy "in_app_notif_select_own"
  on public.in_app_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "in_app_notif_update_own" on public.in_app_notifications;
create policy "in_app_notif_update_own"
  on public.in_app_notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "in_app_notif_delete_own" on public.in_app_notifications;
create policy "in_app_notif_delete_own"
  on public.in_app_notifications for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- follows + follow_requests (requires tables from roadmap_extensions.sql)
-- ---------------------------------------------------------------------------
alter table public.follows enable row level security;
alter table public.follow_requests enable row level security;

drop policy if exists "follows_select_related" on public.follows;
create policy "follows_select_related"
  on public.follows for select
  using (auth.uid() = follower_id or auth.uid() = followee_id);

drop policy if exists "follows_insert_self" on public.follows;
create policy "follows_insert_self"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "follows_delete_self" on public.follows;
create policy "follows_delete_self"
  on public.follows for delete
  using (auth.uid() = follower_id);

drop policy if exists "follow_req_select_parties" on public.follow_requests;
create policy "follow_req_select_parties"
  on public.follow_requests for select
  using (auth.uid() = requester_id or auth.uid() = target_id);

drop policy if exists "follow_req_insert_self" on public.follow_requests;
create policy "follow_req_insert_self"
  on public.follow_requests for insert
  with check (auth.uid() = requester_id and requester_id <> target_id);

-- Status changes: use rpc_follow_requests.sql (accept / reject / cancel) — SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- subscription_state (RevenueCat / store mirror — server writes only)
-- ---------------------------------------------------------------------------
alter table if exists public.subscription_state enable row level security;

drop policy if exists "subscription_state_select_own" on public.subscription_state;
create policy "subscription_state_select_own"
  on public.subscription_state for select
  to authenticated
  using (auth.uid() = user_id);

