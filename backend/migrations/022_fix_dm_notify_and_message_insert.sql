-- Fix 500 on message insert when DM notification trigger fails.
-- Harden notify_recipient_on_dm; ensure sender has a profile row before insert.

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
      -- Do not roll back the message row if notification insert fails.
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
