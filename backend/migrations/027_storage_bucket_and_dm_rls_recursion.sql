-- Create missing `media_assets` storage bucket (app code uses this id; only `media` existed).
-- Fix infinite RLS recursion on conversation_participants (breaks messages + media_assets DM policy).

-- ---------------------------------------------------------------------------
-- 1) Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media_assets',
  'media_assets',
  true,
  52428800,
  null
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- Re-assert object policies (bucket must exist first)
drop policy if exists "storage_media_assets_select_public" on storage.objects;
create policy "storage_media_assets_select_public"
  on storage.objects for select
  to public
  using (bucket_id = 'media_assets');

drop policy if exists "storage_media_assets_insert_own_folder" on storage.objects;
create policy "storage_media_assets_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media_assets'
    and (
      (
        (storage.foldername(name))[1] = 'profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'catalog'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'posts'
        and auth.uid() is not null
      )
      or (
        (storage.foldername(name))[1] = 'events'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'messages'
        and (storage.foldername(name))[3] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'proposals'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "storage_media_assets_update_own_folder" on storage.objects;
create policy "storage_media_assets_update_own_folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'media_assets'
    and (
      (
        (storage.foldername(name))[1] = 'profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'catalog'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'events'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'proposals'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  )
  with check (
    bucket_id = 'media_assets'
    and (
      (
        (storage.foldername(name))[1] = 'profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'catalog'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'events'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'proposals'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists "storage_media_assets_delete_own_folder" on storage.objects;
create policy "storage_media_assets_delete_own_folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'media_assets'
    and (
      (
        (storage.foldername(name))[1] = 'profiles'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'catalog'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'events'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'proposals'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 2) RLS helpers (security definer — no self-referential policy subqueries)
-- ---------------------------------------------------------------------------
create or replace function public.is_conversation_participant(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = p_user_id
  );
$$;

grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

create or replace function public.user_can_read_message_media(p_media_asset_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.messages m
    where m.media_asset_id = p_media_asset_id
      and public.is_conversation_participant(m.conversation_id)
  );
$$;

grant execute on function public.user_can_read_message_media(uuid) to authenticated;

drop policy if exists "cp_select_member" on public.conversation_participants;
create policy "cp_select_member"
  on public.conversation_participants for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "conv_select_member" on public.conversations;
create policy "conv_select_member"
  on public.conversations for select
  using (public.is_conversation_participant(id));

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
  on public.messages for select
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "messages_insert_sender" on public.messages;
create policy "messages_insert_sender"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "messages_delete_participant" on public.messages;
create policy "messages_delete_participant"
  on public.messages for delete
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "media_select_dm_participant" on public.media_assets;
create policy "media_select_dm_participant"
  on public.media_assets for select
  using (public.user_can_read_message_media(id));
