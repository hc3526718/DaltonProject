-- Athlete profile section + catalog upload path in storage policies.

alter table public.profiles add column if not exists athlete_details jsonb not null default '{}'::jsonb;

drop policy if exists "storage_media_assets_insert_own_folder" on storage.objects;
create policy "storage_media_assets_insert_own_folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'media_assets'
    and (
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
  );
