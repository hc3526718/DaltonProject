-- Add host/creator ownership to events (recommended).
-- Run this BEFORE enabling RLS policies that reference `events.created_by`.

alter table public.events
  add column if not exists created_by uuid references public.profiles (id) on delete set null;

-- Optional: backfill existing rows to the current user manually in the table editor,
-- or keep null for legacy/demo seed data.

-- After this runs, you can tighten insert policy to require created_by = auth.uid():
-- drop policy if exists "events_insert_authenticated" on public.events;
-- create policy "events_insert_authenticated"
--   on public.events for insert
--   with check (auth.role() = 'authenticated' and created_by = auth.uid());
