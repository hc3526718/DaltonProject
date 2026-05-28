-- Host check-in by booking reference: sets checked_in_at and notifies the attendee.
-- Run in Supabase SQL editor after schema + RLS.
-- Requires: bookings, events, in_app_notifications tables.

create or replace function public.host_check_in_booking(p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.bookings;
  ev public.events;
begin
  if p_reference is null or length(trim(p_reference)) < 1 then
    return jsonb_build_object('ok', false, 'reason', 'empty_reference');
  end if;

  select * into b
  from public.bookings
  where reference = trim(p_reference)
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'booking_not_found');
  end if;

  select * into ev from public.events where id = b.event_id limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'event_not_found');
  end if;

  if ev.created_by is null or ev.created_by <> auth.uid() then
    return jsonb_build_object('ok', false, 'reason', 'not_event_host');
  end if;

  if b.checked_in_at is not null then
    return jsonb_build_object(
      'ok', true,
      'already_checked_in', true,
      'user_id', b.user_id,
      'event_id', b.event_id::text,
      'title', ev.title
    );
  end if;

  update public.bookings
  set checked_in_at = now()
  where id = b.id;

  insert into public.in_app_notifications (user_id, title, body)
  values (
    b.user_id,
    'Attendance confirmed',
    coalesce('Your attendance for "' || ev.title || '" has been confirmed.', 'Your attendance has been confirmed.')
  );

  return jsonb_build_object(
    'ok', true,
    'already_checked_in', false,
    'user_id', b.user_id,
    'event_id', b.event_id::text,
    'title', ev.title
  );
end;
$$;

revoke all on function public.host_check_in_booking(text) from public;
grant execute on function public.host_check_in_booking(text) to authenticated;
