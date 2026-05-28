-- Event hosts can list bookings on their events (read-only roster for check-in prep).
-- Attendees retain existing bookings_self_all policies for insert/update on own rows.

drop policy if exists "bookings_host_select_own_events" on public.bookings;
create policy "bookings_host_select_own_events"
  on public.bookings for select
  using (
    exists (
      select 1 from public.events e
      where e.id = bookings.event_id
      and e.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Post-event reviews (one per user per event; host can read all for their events)
-- ---------------------------------------------------------------------------

create table if not exists public.event_reviews (
  id uuid primary key default gen_random_uuid (),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists event_reviews_event_idx on public.event_reviews (event_id, created_at desc);

alter table public.event_reviews enable row level security;

drop policy if exists "event_reviews_select_related" on public.event_reviews;
create policy "event_reviews_select_related"
  on public.event_reviews for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.events e
      where e.id = event_reviews.event_id
      and e.created_by = auth.uid()
    )
  );

-- Insert: checked-in attendee only, and at least 1 hour after scheduled event end
-- (end = events.ends_at when set, else starts_at + 3 hours — matches app ticket timing).
drop policy if exists "event_reviews_insert_attendee_after_window" on public.event_reviews;
create policy "event_reviews_insert_attendee_after_window"
  on public.event_reviews for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.bookings b
      join public.events e on e.id = b.event_id
      where b.event_id = event_reviews.event_id
      and b.user_id = auth.uid()
      and b.checked_in_at is not null
      and now()
        >= (
          coalesce(
            e.ends_at,
            e.starts_at + interval '3 hours'
          ) + interval '1 hour'
        )
    )
  );

drop policy if exists "event_reviews_update_own" on public.event_reviews;
create policy "event_reviews_update_own"
  on public.event_reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
