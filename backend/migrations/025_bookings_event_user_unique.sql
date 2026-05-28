-- Prevent duplicate bookings for the same user + event (paid webhook + client safety).

create unique index if not exists bookings_user_event_unique_idx
  on public.bookings (user_id, event_id);
