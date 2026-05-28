-- Apple Wallet pass registration + booking pass lifecycle.

alter table public.bookings add column if not exists pass_voided boolean not null default false;
alter table public.bookings add column if not exists voided_at timestamptz;
alter table public.bookings add column if not exists wallet_auth_token text;

create table if not exists public.wallet_passes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  device_library_id text not null,
  push_token text not null,
  pass_type_id text not null,
  serial_number text not null,
  created_at timestamptz not null default now(),
  unique (device_library_id, pass_type_id, serial_number)
);

create index if not exists wallet_passes_booking_idx on public.wallet_passes (booking_id);
create index if not exists wallet_passes_serial_idx on public.wallet_passes (serial_number);

alter table public.wallet_passes enable row level security;

drop policy if exists "wallet_passes_service_only" on public.wallet_passes;
create policy "wallet_passes_service_only"
  on public.wallet_passes
  for all
  to authenticated
  using (false)
  with check (false);

-- Void pass when attendee is checked in.
create or replace function public.void_wallet_pass_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.checked_in_at is not null and (old.checked_in_at is null or old.checked_in_at is distinct from new.checked_in_at) then
    new.pass_voided := true;
    new.voided_at := coalesce(new.voided_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_void_wallet_pass_on_checkin on public.bookings;
create trigger bookings_void_wallet_pass_on_checkin
  before update of checked_in_at on public.bookings
  for each row
  execute function public.void_wallet_pass_on_checkin();

-- Prevent duplicate bookings for the same user + event (idempotent apply).
create unique index if not exists bookings_user_event_unique_idx
  on public.bookings (user_id, event_id);
