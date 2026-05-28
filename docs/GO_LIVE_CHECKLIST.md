# Go live checklist — The Dalton Grant Academy / The Dalton Grant Academy

Use this alongside [`REMAINING_IMPLEMENTATION.md`](./REMAINING_IMPLEMENTATION.md) and [`SUBMISSION_READINESS.md`](./SUBMISSION_READINESS.md).

## What MCP verified in this workspace (automated)

| Check | Result | Tool |
|--------|--------|------|
| Sentry MCP authenticated | Connected as configured user | `project-0-DaltonProject-sentry` → `whoami` |
| Storage bucket `media_assets` exists | Present on linked Supabase project | `user-supabase` → `execute_sql` |

Re-run periodically before release (`execute_sql`: `select id from storage.buckets where id = 'media_assets'`).

---

## Must do manually (no safe way to automate from the repo)

| Area | Action |
|------|--------|
| **Stripe** | Stripe Dashboard → **Live** keys. Set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to **`pk_live_…`** on Vercel + EAS. Supabase Edge Function secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, **`STRIPE_WEBHOOK_SIGNING_SECRET` / price IDs** as in billing docs. Sandbox webhooks ≠ live. |
| **RevenueCat** | Attach **production** App Store / Play products; use public SDK keys `appl_` / `goog_` (**not** `test_`). Set `EXPO_PUBLIC_REVENUECAT_*` in EAS/Vercel. Ensure offering “current” points at live SKUs (`REVENUECAT.md`). RevenueCat MCP can **list** entitlements/offerings — use read-only audit before flipping traffic. |
| **Supabase** | Production project URL + **anon** key in `EXPO_PUBLIC_SUPABASE_*`. Service role stays in Edge Function secrets only. Apply pending migrations (`024–029`) if not applied. |

---

## Implemented in-app / config (recent)

| Topic | Behaviour |
|--------|-----------|
| **Bundled demo passwords** | Removed from source. `__DEV__` only + `EXPO_PUBLIC_DEV_DEMO_LEGACY_PASSWORD` / `EXPO_PUBLIC_DEV_DEMO_PREMIUM_PASSWORD` in `.env`. Release builds never accept bundled demo passwords. |
| **Media search demo rows** | Shown only in dev, screenshot mode, or if `EXPO_PUBLIC_ALLOW_MEDIA_SEARCH_DEMO=1`. Production defaults to catalogue or empty state. |
| **Android cleartext** | **Off** unless `EXPO_PUBLIC_ANDROID_ALLOW_CLEARTEXT=true` (e.g. local Metro HTTP debugging). |

---

## Sentry — runtime errors vs terminal (CMD/PowerShell)

### What reaches Sentry today

1. **`EXPO_PUBLIC_SENTRY_DSN`** set at **build time** (EAS/Vercel) so Metro inlines it into web + native bundles.  
2. **`initSentryFromEnv()`** runs in [`index.ts`](../index.ts).  
3. With **`EXPO_PUBLIC_SENTRY_FORWARD_CONSOLE_ERRORS`** not equal to **`0`** (default behaviour):
   - **Release builds** (`!__DEV__`): `console.error` is wrapped so **`Error`** objects are also **`captureException`**, helping **especially on web** when libraries log failures to the console.  
   - **Dev builds**: forwarding is **off** unless you set `EXPO_PUBLIC_SENTRY_FORWARD_CONSOLE_ERRORS=1` (reduces spam while developing).

Unhandled promise rejections and native crashes are handled by the SDK where supported (`@sentry/react-native` + web).

### What does **not** go to Sentry automatically

| Source | Reason |
|---------|--------|
| **Local terminal** (`expo start`, `npx expo export`, ESLint exit codes) | Those processes are not your deployed app session. |
| **Vercel / GitHub Actions build failures** | Not the browser SDK unless you add a CI step |

**Recommended for CI/CD:** GitHub Action or Vercel build step runs `sentry-cli releases ... sourcemaps upload` ([`MONITORING_AND_ANALYTICS.md`](./MONITORING_AND_ANALYTICS.md)); optional **Crafted**/`sentry-webpack-plugin` already partially wired via EAS plugin. For **pure build failures**, use Sentry Cron or forwarding from your CI logs — not automatic from this repo.

---

## Production env template (minimal)

Paste into EAS/Vercel (Production); never commit `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
EXPO_PUBLIC_DALTON_WEB_URL=https://your-production-domain
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=appl_...
EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=goog_...
EXPO_PUBLIC_SENTRY_DSN=https://...@....ingest.sentry.io/...
# EXPO_PUBLIC_SENTRY_FORWARD_CONSOLE_ERRORS=0   # uncomment to disable console.forwarder
EXPO_PUBLIC_TICKET_SIGNING_SECRET=<long random, matches server>
# Do NOT set EXPO_PUBLIC_APP_STORE_SCREENSHOTS in production.
# Do NOT set EXPO_PUBLIC_ALLOW_MEDIA_SEARCH_DEMO in production unless you intentionally want demos.
```

---

## Counsel / storefront (still your responsibility)

- Replace legal copy with lawyer-reviewed text (operator identity, ICO/GDPR, refunds). Root `terms.html` / `privacy.html` headers were de-bracketed to operational placeholders — **still review before launch.**
