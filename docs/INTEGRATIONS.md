# External integrations

**Related:** `docs/NEXT_STEPS.md` §1 & §7, `docs/SECRETS_CHECKLIST.md` (Stripe, webhooks).

## Calendars

### Phase 1 — ICS file (implemented in app)
- Build an `.ics` string on-device (`src/integrations/eventCalendar.ts`).
- Write to cache with `expo-file-system`, share via `expo-sharing` so the user opens Calendar / Mail.
- No OAuth; works offline; good MVP.

### Phase 2 — Google Calendar / Microsoft Graph
- OAuth via Supabase Auth provider or native `expo-auth-session`.
- Server creates event via API using a **refresh token** stored server-side (never ship client secrets in the app).

## Payments (Stripe)

### Class checkout
1. App calls your API: `POST /bookings/checkout` with `event_id`, `user_id` (from JWT).
2. API creates **Stripe Checkout Session** or **PaymentIntent**; returns `client_secret` or `url`.
3. App opens **Stripe Checkout** (WebView / `Linking`) or **Payment Sheet** (native SDK in dev build).
4. **Webhook** `checkout.session.completed` / `payment_intent.succeeded` updates `bookings.payment_status = 'paid'` and finalizes seat.

### Connect (pay coaches later)
- Use **Stripe Connect** Express/Custom accounts for coaches; `application_fee_amount` on Checkout.

### Webhook security
- Verify `Stripe-Signature` with webhook signing secret on the server only.

## Env vars (server)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, optional `STRIPE_CONNECT_CLIENT_ID`.
