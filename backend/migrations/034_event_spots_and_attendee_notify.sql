-- Live event registration counts + notify booked users when event details change.

alter table public.events
  add column if not exists registered_count integer not null default 0;

-- Backfill counts from existing bookings.
update public.events e
set registered_count = sub.cnt
from (
  select event_id, count(*)::int as cnt
  from public.bookings
  group by event_id
) sub
where e.id = sub.event_id;

create or replace function public.refresh_event_registered_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eid uuid;
begin
  eid := coalesce(NEW.event_id, OLD.event_id);
  update public.events
  set registered_count = (
    select count(*)::int from public.bookings where event_id = eid
  )
  where id = eid;
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists trg_bookings_refresh_event_count on public.bookings;
create trigger trg_bookings_refresh_event_count
  after insert or delete on public.bookings
  for each row
  execute function public.refresh_event_registered_count();

create or replace function public.notify_booked_users_on_event_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed boolean;
begin
  if tg_op <> 'UPDATE' then
    return NEW;
  end if;

  changed := (
    old.title is distinct from new.title
    or old.venue is distinct from new.venue
    or old.starts_at is distinct from new.starts_at
    or old.ends_at is distinct from new.ends_at
    or old.hero_image_url is distinct from new.hero_image_url
    or old.description is distinct from new.description
    or old.entry_payment_mode is distinct from new.entry_payment_mode
    or old.entry_payment_amount is distinct from new.entry_payment_amount
    or old.entry_payment_note is distinct from new.entry_payment_note
  );

  if not changed then
    return NEW;
  end if;

  insert into public.in_app_notifications (user_id, title, body, link_type, link_id, created_at)
  select distinct b.user_id,
    'Event updated',
    format('%s has new details. Open the event to review.', new.title),
    'event',
    new.id,
    now()
  from public.bookings b
  where b.event_id = new.id;

  return NEW;
end;
$$;

drop trigger if exists trg_notify_booked_users_on_event_update on public.events;
create trigger trg_notify_booked_users_on_event_update
  after update on public.events
  for each row
  execute function public.notify_booked_users_on_event_update();
