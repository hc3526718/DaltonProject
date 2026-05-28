# Monitoring, errors, and product analytics

Short comparison of platforms teams commonly use with **Expo / React Native** to catch crashes, watch usage, and track funnels. Pick **one** primary error tool and **one** analytics stack to avoid noise and double-billing.

## Error & crash reporting

| Platform | Strengths | Expo / RN notes |
|----------|-------------|-----------------|
| **[Sentry](https://sentry.io/)** | Source maps, release health, breadcrumbs, performance traces, issue grouping, Slack/email alerts | First-class [React Native SDK](https://docs.sentry.io/platforms/react-native/); works with EAS builds; widely used in production. |
| **[Bugsnag](https://www.bugsnag.com/)** | Stability scores, release comparison | Solid RN support; similar role to Sentry. |
| **[Firebase Crashlytics](https://firebase.google.com/docs/crashlytics)** | Free tier, Google ecosystem | Needs native config; works with Expo prebuild + `expo-build-properties`; good if you already use Firebase. |
| **Datadog RUM** | Full-stack (API + mobile + logs) in one vendor | Heavier setup; best when you already standardize on Datadog. |

**Practical pick:** **Sentry** for most indie/small teams (fast setup, great RN docs, actionable alerts). Add **Crashlytics** instead if you are all-in on Firebase.

## Product analytics & funnels (events, retention, dashboards)

| Platform | Strengths | Notes |
|----------|-------------|--------|
| **[PostHog](https://posthog.com/)** | Event capture, funnels, feature flags, session replay (web), self-host option | Strong for product-led teams; can run EU cloud or self-hosted. |
| **[Amplitude](https://amplitude.com/)** | Behavioral analytics, cohorts, mature dashboards | Common for growth teams; paid tiers at scale. |
| **[Mixpanel](https://mixpanel.com/)** | Similar to Amplitude; strong funnel / retention views | Very common in mobile apps. |
| **[Google Analytics 4](https://analytics.google.com/) (Firebase)** | Free, ties to Firebase / BigQuery | Good baseline; less flexible than PostHog/Amplitude for product deep-dives. |

**Practical pick:** **PostHog** (flexibility + flags + optional self-host) or **Amplitude** (polished SaaS analytics). Use a **single** schema for event names (e.g. `event_booking_started`, `media_upload_submitted`).

## Backend & API monitoring

- **Supabase:** Dashboard for DB health, logs, Edge Function logs; enable **Log Explorer** and alerts where available.
- **Uptime:** [Better Stack](https://betterstack.com/), [Pingdom](https://www.pingdom.com/), or Cloudflare Health Checks for API + marketing site.
- **Logs:** If on AWS/GCP, ship to CloudWatch / Cloud Logging; correlate with Sentry `trace_id` if you add custom headers.

## Recommended “starter stack” for this app

1. **Sentry** — JS errors, native crashes, releases tied to EAS build numbers.  
2. **PostHog or Amplitude** — Screen views, `booking_completed`, `paywall_viewed`, `creator_upload_submitted`.  
3. **Supabase** — RLS audit, Storage failures, Edge Function logs for Wallet / QR.  
4. **Manual checks** — `STORE_RELEASE.md` preflight before each store submission.

## Sentry in this repo (implemented)

1. **Dependency:** `@sentry/react-native` (Expo SDK 54–compatible).  
2. **Init:** `index.ts` calls `initSentryFromEnv()` from `src/monitoring/sentryBoot.ts` when **`EXPO_PUBLIC_SENTRY_DSN`** is set.  
3. **Root:** `App.tsx` is wrapped with **`Sentry.wrap`**.  
4. **Metro:** `metro.config.js` uses **`getSentryExpoConfig`** (debug IDs / source maps) while keeping the **SVG + `.riv`** resolver setup.  
5. **Expo config:** `app.config.js` includes the **`@sentry/react-native/expo`** plugin. **`eas.json`** sets **`SENTRY_DISABLE_AUTO_UPLOAD=true`** on all build profiles so **EAS iOS/Android builds succeed** without Sentry org secrets (runtime crash reporting via **`EXPO_PUBLIC_SENTRY_DSN`** still works). To **turn on** automatic source map uploads: remove that env var (or set it to `false`) on the profile and add EAS secrets **`SENTRY_AUTH_TOKEN`**, **`SENTRY_ORG`**, **`SENTRY_PROJECT`** (see [Sentry Expo source maps](https://docs.sentry.io/platforms/react-native/sourcemaps/uploading/expo/)). Alternatively keep uploads off and upload maps manually from CI.  
6. **Boot / Rive:** Native Rive errors surface via the player callback; optional Sentry wiring can use `captureBootRiveIssue` from `sentryBoot.ts`. **`AuthContext`** reports **`supabase_get_session_timeout`** if `getSession` hangs (when full auth bootstrap is enabled).

After changing native config, run a **new EAS build** (not only OTA). Copy **`EXPO_PUBLIC_SENTRY_DSN`** from [Sentry](https://sentry.io/) → Project → Client Keys (DSN).

## Implementation order

1. **Sentry** — set `EXPO_PUBLIC_SENTRY_DSN`, rebuild dev/preview; confirm a test event in the Sentry UI.  
2. Define 10–15 core events in a small `analytics.ts` wrapper (no-op in `__DEV__` if desired).  
3. Wire **RevenueCat** purchase events into the same analytics layer.  
4. Document event names in this file or `INTEGRATIONS.md` so naming stays consistent.

See also `WHAT_NEXT.md`, `SECRETS_CHECKLIST.md`, and `REVENUECAT.md`.
