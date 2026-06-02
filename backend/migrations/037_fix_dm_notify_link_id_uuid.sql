-- Fix message send failure: link_id is uuid, not text (036 cast conversation_id::text).

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

  begin
    insert into public.in_app_notifications (user_id, title, body, read_at, created_at, link_type, link_id)
    values (
      recipient,
      'New message from ' || sender_name,
      snippet,
      null,
      now(),
      'conversation',
      new.conversation_id
    );
  exception
    when others then
      raise warning 'notify_recipient_on_dm failed: %', sqlerrm;
  end;

  return new;
end;
$$;
