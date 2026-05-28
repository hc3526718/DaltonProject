-- DM privacy enforcement + in-app notification when a message is received.

create or replace function public.dm_peer_allows_sender(p_sender uuid, p_recipient uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pref text;
  sender_follows boolean;
  mutual boolean;
begin
  if p_sender is null or p_recipient is null or p_sender = p_recipient then
    return false;
  end if;

  select coalesce(p.allow_messages_from, 'everyone')
  into pref
  from public.profiles p
  where p.id = p_recipient;

  if pref is null then
    return false;
  end if;

  if pref = 'everyone' then
    return true;
  end if;

  select exists (
    select 1 from public.follows f
    where f.follower_id = p_sender and f.followee_id = p_recipient
  ) into sender_follows;

  if pref = 'followers_only' then
    return sender_follows;
  end if;

  if pref = 'friends_only' then
    select sender_follows and exists (
      select 1 from public.follows f2
      where f2.follower_id = p_recipient and f2.followee_id = p_sender
    ) into mutual;
    return mutual;
  end if;

  return true;
end;
$$;

revoke all on function public.dm_peer_allows_sender(uuid, uuid) from public;
grant execute on function public.dm_peer_allows_sender(uuid, uuid) to authenticated;

create or replace function public.can_message_peer(other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.dm_peer_allows_sender(auth.uid(), other_user_id);
$$;

revoke all on function public.can_message_peer(uuid) from public;
grant execute on function public.can_message_peer(uuid) to authenticated;

create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  n int;
begin
  if other_user_id is null or other_user_id = auth.uid() then
    raise exception 'invalid peer';
  end if;

  if not public.dm_peer_allows_sender(auth.uid(), other_user_id) then
    raise exception 'dm_not_allowed'
      using errcode = 'P0001',
        message = 'This user does not accept messages from you.';
  end if;

  select c.id into conv_id
  from public.conversations c
  where exists (
    select 1 from public.conversation_participants p1
    where p1.conversation_id = c.id and p1.user_id = auth.uid()
  )
  and exists (
    select 1 from public.conversation_participants p2
    where p2.conversation_id = c.id and p2.user_id = other_user_id
  );

  if conv_id is not null then
    select count(*)::int into n from public.conversation_participants where conversation_id = conv_id;
    if n = 2 then
      return conv_id;
    end if;
  end if;

  insert into public.conversations default values
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id) values (conv_id, auth.uid());
  insert into public.conversation_participants (conversation_id, user_id) values (conv_id, other_user_id);

  return conv_id;
end;
$$;

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
  select p.user_id into recipient
  from public.conversation_participants p
  where p.conversation_id = new.conversation_id
    and p.user_id <> new.sender_id
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

  insert into public.in_app_notifications (user_id, title, body, read_at, created_at)
  values (
    recipient,
    'New message from ' || sender_name,
    snippet,
    null,
    now()
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_recipient_on_dm on public.messages;
create trigger trg_notify_recipient_on_dm
  after insert on public.messages
  for each row
  execute function public.notify_recipient_on_dm();
