-- Run after schema.sql + rls_policies (conversations + participants policies).
-- Creates a 1:1 conversation between auth.uid() and other_user_id if none exists.
-- Enforces recipient allow_messages_from via dm_peer_allows_sender (see migration 018).

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

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
