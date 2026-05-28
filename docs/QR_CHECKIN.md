# QR check-in

**Related:** `docs/NEXT_STEPS.md` §1 & §7.1, `docs/ACCESS_MODEL.md` (staff `check_in_attendees`), `docs/SECRETS_CHECKLIST.md`.

## Token format (client demo)
`base64url(JSON payload).hex_sha256(secret + "." + base64url)`

- **Payload** (`TicketPayloadV1`): `{ v, ref, uid, eventId?, exp }` (see `src/booking/ticketToken.ts`).
- **Secret**: `EXPO_PUBLIC_TICKET_SIGNING_SECRET` must match server `TICKET_HMAC_SECRET` in production (prefer server-only signing for prod).

## Production flow
1. On paid/confirmed booking, **API** issues token (or short-lived JWT) and stores `bookings.reference`.
2. Client shows QR encoding the token (`BookingQrCode` component).
3. **Staff** scans → app sends `POST /api/checkin` with raw token string.
4. Server verifies signature / JWT, sets `bookings.checked_in_at` idempotently, returns `{ ok, alreadyCheckedIn }`.

## Staff UI
- `StaffCheckInScreen` (Events stack): paste token for demo; camera scanner can use `expo-camera` / `vision-camera` in a dev build later.

## Supabase (Dalton app)

- Hosts scan via `HostAttendeeScanScreen` calling RPC `host_check_in_booking`; attendees receive `in_app_notifications` when checked in.
- **Host roster:** Migration `031_host_bookings_and_event_reviews.sql` grants hosts `SELECT` on `bookings` for their events (read-only roster alongside `bookings_self_all`). `CreatorEventDetailView` lists sign-ups and LIVE check-in state (Realtime on `bookings` + pull-to-refresh — turn on replication in the Supabase dashboard if updates do not stream).
- **Post-event reviews:** `event_reviews` — RLS allows checked-in attendees to insert after “end + 1 hour” (scheduled end = `ends_at` or `starts_at + 3h`); organisers read all reviews for events they created on the same host dashboard.
