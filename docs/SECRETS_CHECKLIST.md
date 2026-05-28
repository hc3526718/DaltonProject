# What you need to paste / configure (outside the repo)

Use this when moving from demo to production. **Roadmap:** `docs/NEXT_STEPS.md` (especially §3–§7).

## Supabase

- [ ] Project URL + **anon** key → `.env` as `EXPO_PUBLIC_SUPABASE_*`
- [ ] **Service role** key → server / Edge Functions only (never in the app)
- [ ] Run `backend/schema.sql` (adjust RLS policies)
- [ ] Storage buckets + policies for `media_assets` paths
- [ ] Optional: Apple/Google OAuth in Authentication settings

## Stripe (paid classes)

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` on server
- [ ] Webhook endpoint for `checkout.session.completed` / payment intents
- [ ] Price IDs on `events` rows

## RevenueCat

- [ ] iOS + Android API keys in `.env` (see `REVENUECAT.md`)
- [ ] Webhook to your API to sync `subscription_state`

## EAS / stores

- [ ] `eas secret:create` for any private env not prefixed with `EXPO_PUBLIC_`
- [ ] Apple Developer: certificates, identifiers, App Store Connect app
- [ ] Google Play: service account for `eas submit` (optional)

## Tickets / QR

- [ ] Replace `EXPO_PUBLIC_TICKET_SIGNING_SECRET` with a strong secret; mirror on server for `POST /checkin`

## Optional analytics

- [ ] **`EXPO_PUBLIC_SENTRY_DSN`** in `.env` + EAS (see `MONITORING_AND_ANALYTICS.md`); optional `SENTRY_AUTH_TOKEN` / org / project for upload maps

If you tell me which provider you enabled first (Supabase vs Stripe vs RevenueCat), we can wire the smallest vertical slice end-to-end in a follow-up session.
