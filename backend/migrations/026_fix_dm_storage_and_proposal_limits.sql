-- DM notify hardening, full storage policies (profiles/posts/messages), message media read, proposal monthly cap (all kinds).

-- 1) DM notification must never roll back message insert
create or replace function public.notify_recipient_on_dm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  sender_name text;
  snippet text;
begin
  select cp.user_id into recipient
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id
  limit 1;

  if recipient is null then
    return new;
  end if;

  select coalesce(nullif(trim(pr.display_name), ''), nullif(trim(pr.username), ''), 'Someone')
  into sender_name
  from public.profiles pr
  where pr.id = new.sender_id;

  snippet := left(trim(coalesce(new.body, '')), 120);
  if snippet = '' then
    snippet := 'Sent you a message';
  end if;

  begin
    insert into public.in_app_notifications (user_id, title, body, read_at, created_at)
    values (
      recipient,
      'New message from ' || sender_name,
      snippet,
      null,
      now()
    );
  exception
    when others then
      raise warning 'notify_recipient_on_dm failed: %', sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.ensure_sender_profile_before_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.sender_id, 'Member')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_ensure_sender_profile_before_message on public.messages;
create trigger trg_ensure_sender_profile_before_message
  before insert on public.messages
  for each row
  execute function public.ensure_sender_profile_before_message();

-- 2) Storage: public read + authenticated upload paths (profiles, posts, events, messages, proposals, catalog)
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

-- 3) Allow conversation participants to read media attached to their DMs
drop policy if exists "media_select_dm_participant" on public.media_assets;
create policy "media_select_dm_participant"
  on public.media_assets for select
  using (
    exists (
      select 1
      from public.messages m
      join public.conversation_participants cp
        on cp.conversation_id = m.conversation_id
      where m.media_asset_id = media_assets.id
        and cp.user_id = auth.uid()
    )
  );

-- 4) Max 3 content proposals per author per calendar month (all kinds)
create or replace function public.content_proposals_this_month_count(p_author_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.content_proposals cp
  where cp.author_id = p_author_id
    and cp.created_at >= date_trunc('month', now() at time zone 'utc');
$$;

grant execute on function public.content_proposals_this_month_count(uuid) to authenticated;

create or replace function public.can_submit_content_proposal()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.content_proposals_this_month_count(auth.uid()) < 3;
$$;

grant execute on function public.can_submit_content_proposal() to authenticated;

create or replace function public.enforce_sponsor_proposal_monthly_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*)::integer
  into n
  from public.content_proposals cp
  where cp.author_id = new.author_id
    and cp.created_at >= date_trunc('month', now() at time zone 'utc');
  if n >= 3 then
    raise exception 'proposal_monthly_limit'
      using errcode = 'P0001',
        message = 'Maximum 3 proposals per calendar month.';
  end if;
  return new;
end;
$$;
