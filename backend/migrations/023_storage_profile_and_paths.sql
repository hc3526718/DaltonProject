-- Storage policies for profile avatars/banners and common upload prefixes.
-- Fixes 400 Bad Request on storage.objects insert for profiles/{user_id}/...

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
      (storage.foldername(name))[1] = 'profiles'
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
        (storage.foldername(name))[1] = 'events'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'proposals'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );
