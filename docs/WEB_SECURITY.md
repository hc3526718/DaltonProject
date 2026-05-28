# Web security (Vercel + Supabase + Stripe + RevenueCat + Sentry)

Operational checklist for the The Dalton Grant Academy web deployment at `https://daltongrantacademy.vercel.app`.

## Platform controls

| Layer | Control |
|-------|---------|
| **Vercel** | Security headers in root `vercel.json` (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`). Restrict production env vars to Production only; never commit service role or webhook secrets. |
| **Supabase** | RLS on all public tables; anon key only in client; service role only in Edge Functions. Enable leaked-password protection and Auth rate limits. Run advisors after migrations (`021_messages_delete_participant.sql`, etc.). |
| **Stripe** | Webhook signature verification with `STRIPE_WEBHOOK_SECRET`; publishable key only in client; price IDs from env. |
| **RevenueCat** | Webhook → `subscription_state`; client `Purchases.logIn(supabaseUserId)`; never trust SDK alone for server gates. |
| **Sentry** | Separate DSNs for staging/production; scrub PII in `beforeSend`; no secrets in breadcrumbs. |

## Application rules

1. **Never** ship `SUPABASE_SERVICE_ROLE_KEY`, Stripe secret, Resend API key, or master PIN material in `EXPO_PUBLIC_*` or static HTML.
2. **CORS** on Edge Functions should allow only `https://daltongrantacademy.vercel.app` (and preview URLs you control), not `*`, when browsers call them with user JWTs.
3. **Uploads** go to Supabase Storage `media_assets` with owner RLS; post and profile URLs use `visibility: public` where the feed must read them; DM attachments use public visibility with unguessable paths (consider participant-only SELECT policy in a follow-up migration).
4. **Session** — Supabase Auth refresh tokens in secure storage on native; web uses default Supabase session persistence; sign out clears local prefs.
5. **Blocking** — blocked user IDs stored in `user_settings.preferences.blocked_user_ids`; enforce server-side in a future RPC before `get_or_create_dm`.

## Incident response

1. Rotate compromised keys in Vercel + Supabase + Stripe dashboards.
2. Revoke active sessions (Supabase Auth → Users) for affected accounts.
3. Review Sentry + Supabase logs for anomalous `messages` deletes or storage uploads.

See also `expo-app/docs/SECURITY_AUDIT.md` for the full product-wide review.
