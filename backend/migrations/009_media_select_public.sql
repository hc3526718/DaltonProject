-- Allow authenticated users to read others' media when visibility is public (library / feed).
drop policy if exists "media_select_public_or_own" on public.media_assets;
create policy "media_select_public_or_own"
  on public.media_assets for select
  using (
    auth.uid() = owner_id
    or visibility = 'public'
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.master_control = 'yes'
    )
  );
