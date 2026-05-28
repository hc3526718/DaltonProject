-- Security hardening (Supabase advisor follow-ups).
-- Apply via Supabase SQL Editor after migrations 003-006.
-- Idempotent: each statement uses IF EXISTS / DROP-CREATE patterns.

-- ---------------------------------------------------------------------------
-- 1) Revoke EXECUTE on SECURITY DEFINER functions from `anon`.
--    Trigger-only functions (handle_new_user, notify_admins_on_post_report,
--    auth_user_set_default_dalton_verified, profiles_lock_dalton_verified_for_self)
--    must NEVER be reachable through PostgREST. RPC-style functions stay
--    callable by `authenticated` only.
-- ---------------------------------------------------------------------------

revoke execute on function public.handle_new_user() from anon, public;
revoke execute on function public.notify_admins_on_post_report() from anon, public;
revoke execute on function public.auth_user_set_default_dalton_verified() from anon, public;
revoke execute on function public.profiles_lock_dalton_verified_for_self() from anon, public;

revoke execute on function public.accept_follow_request(uuid) from anon, public;
revoke execute on function public.reject_follow_request(uuid) from anon, public;
revoke execute on function public.cancel_follow_request(uuid) from anon, public;
revoke execute on function public.get_or_create_dm(uuid) from anon, public;
revoke execute on function public.host_check_in_booking(text) from anon, public;

-- Re-grant to authenticated where the app actually calls them.
grant execute on function public.accept_follow_request(uuid) to authenticated;
grant execute on function public.reject_follow_request(uuid) to authenticated;
grant execute on function public.cancel_follow_request(uuid) to authenticated;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.host_check_in_booking(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Add owner-only RLS for tables that had RLS on but no policies.
--    Without policies these tables silently reject all client access.
-- ---------------------------------------------------------------------------

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
create policy "device_push_tokens_select_own"
  on public.device_push_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "device_push_tokens_upsert_own_insert" on public.device_push_tokens;
create policy "device_push_tokens_upsert_own_insert"
  on public.device_push_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "device_push_tokens_upsert_own_update" on public.device_push_tokens;
create policy "device_push_tokens_upsert_own_update"
  on public.device_push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "device_push_tokens_delete_own" on public.device_push_tokens;
create policy "device_push_tokens_delete_own"
  on public.device_push_tokens for delete
  using (auth.uid() = user_id);

alter table public.sponsorship_submissions enable row level security;

drop policy if exists "sponsorship_submissions_insert_self" on public.sponsorship_submissions;
create policy "sponsorship_submissions_insert_self"
  on public.sponsorship_submissions for insert
  with check (auth.uid() = submitter_id);

drop policy if exists "sponsorship_submissions_select_self" on public.sponsorship_submissions;
create policy "sponsorship_submissions_select_self"
  on public.sponsorship_submissions for select
  using (auth.uid() = submitter_id);

-- ---------------------------------------------------------------------------
-- 3) De-duplicate legacy permissive policies flagged by the advisor as
--    `multiple_permissive_policies`. The newer `*_own` / `*_self_all` /
--    `*_select_member` policies (in rls_policies.sql + 006) supersede the
--    earlier `*_authenticated`-style duplicates. Drops are no-ops if the
--    legacy policies were never created on this project.
-- ---------------------------------------------------------------------------

drop policy if exists "posts_select_authenticated" on public.posts;
drop policy if exists "posts_insert_own" on public.posts;
drop policy if exists "posts_update_own" on public.posts;
drop policy if exists "posts_delete_own" on public.posts;
drop policy if exists "post_likes_insert_own" on public.post_likes;
drop policy if exists "post_likes_delete_own" on public.post_likes;
drop policy if exists "post_likes_select_all" on public.post_likes;
drop policy if exists "post_reactions_insert_own" on public.post_reactions;
drop policy if exists "post_reactions_delete_own" on public.post_reactions;
drop policy if exists "post_reactions_select_all" on public.post_reactions;
drop policy if exists "post_comments_insert_own" on public.post_comments;
drop policy if exists "post_comments_select_all" on public.post_comments;
drop policy if exists "post_comments_delete_own" on public.post_comments;
drop policy if exists "messages_select_participant" on public.messages;
drop policy if exists "messages_insert_participant" on public.messages;
drop policy if exists "messages_update_own" on public.messages;
drop policy if exists "messages_delete_own" on public.messages;
drop policy if exists "media_insert_own" on public.media_assets;
drop policy if exists "media_update_own" on public.media_assets;
drop policy if exists "media_delete_own" on public.media_assets;
drop policy if exists "media_select_owner_or_public" on public.media_assets;
drop policy if exists "bookings_select_own" on public.bookings;
drop policy if exists "bookings_insert_own" on public.bookings;
drop policy if exists "bookings_update_own" on public.bookings;
drop policy if exists "profiles_select_own" on public.profiles;
