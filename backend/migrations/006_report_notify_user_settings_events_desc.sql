-- In-app bell: notify admin/super_admin users when a post is reported.
-- Push: add Supabase Database Webhook on post_reports or call Edge Function from extension.

create or replace function public.notify_admins_on_post_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.in_app_notifications (user_id, title, body)
  select u.id,
    'New post report',
    format('%s · post %s', new.reason, left(replace(new.post_id::text, '-', ''), 8))
  from auth.users u
  where coalesce(u.raw_user_meta_data->>'role', '') in ('admin', 'super_admin')
     or coalesce(u.raw_app_meta_data->>'role', '') in ('admin', 'super_admin');
  return new;
end;
$$;

drop trigger if exists trg_post_reports_notify_admins on public.post_reports;
create trigger trg_post_reports_notify_admins
  after insert on public.post_reports
  for each row
  execute function public.notify_admins_on_post_report();

-- user_settings: enable client read/write for owning user (RLS was on without policies).
drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.events add column if not exists description text;
