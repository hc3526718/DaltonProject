-- All profiles public; DM notifications link to conversations; optional push dispatch via pg_net.

-- Force public profiles in stored preferences.
update public.user_settings
set preferences = jsonb_set(
  coalesce(preferences, '{}'::jsonb),
  '{privacy,profile_public}',
  'true'::jsonb,
  true
)
where coalesce(preferences->'privacy'->>'profile_public', 'true') = 'false';

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

  insert into public.in_app_notifications (user_id, title, body, read_at, created_at, link_type, link_id)
  values (
    recipient,
    'New message from ' || sender_name,
    snippet,
    null,
    now(),
    'conversation',
    new.conversation_id::text
  );

  return new;
end;
$$;

-- pg_net: enqueue Expo push when in_app_notifications row is inserted (requires Vault secret `service_role_key`).
create extension if not exists pg_net with schema extensions;

create or replace function public.enqueue_in_app_push_dispatch()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fn_url text := 'https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/dispatch-in-app-push';
  svc_key text;
begin
  begin
    select decrypted_secret into svc_key
    from vault.decrypted_secrets
    where name = 'service_role_key'
    limit 1;
  exception when others then
    svc_key := null;
  end;

  if svc_key is null or length(trim(svc_key)) = 0 then
    return NEW;
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := jsonb_build_object('notification_id', NEW.id::text)
  );

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_in_app_push_dispatch on public.in_app_notifications;
create trigger trg_enqueue_in_app_push_dispatch
  after insert on public.in_app_notifications
  for each row
  execute function public.enqueue_in_app_push_dispatch();
