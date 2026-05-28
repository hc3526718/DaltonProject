# Remaining tasks — full playbook (navigate each system)

This document lists **everything still to complete** for the Dalton Expo app after **Supabase core DB/auth** is done. It is **UI- and dashboard-oriented**: where to go, what to click, and how to **verify** each task.

**Already done (assumed):** Supabase migrations (tables, RLS baseline, onboarding columns), local `.env` + EAS Supabase secrets, app UI in good shape.

**Companion docs:** [WHAT_NEXT.md](./WHAT_NEXT.md) (order), [SETUP_FROM_STEP2_DETAILED.md](./SETUP_FROM_STEP2_DETAILED.md) (summary stages), [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md), [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md), [BACKEND_AUTH.md](./BACKEND_AUTH.md), [STORAGE.md](./STORAGE.md), [REVENUECAT.md](./REVENUECAT.md), [MONETIZATION.md](./MONETIZATION.md), [QR_CHECKIN.md](./QR_CHECKIN.md), [STORE_RELEASE.md](./STORE_RELEASE.md), [MONITORING_AND_ANALYTICS.md](./MONITORING_AND_ANALYTICS.md), [INTEGRATIONS.md](./INTEGRATIONS.md).

---

## How to use this playbook

1. Work **top to bottom** unless a section says it depends on another (e.g. RevenueCat needs store product IDs first).
2. After each subsection, use the **“Verify”** bullets before moving on.
3. **Never paste secrets into chat** — put keys only in `.env` (gitignored) and **EAS Environment Variables** / **EAS Secrets**.

---

## Table of contents

1. [Supabase — remaining work](#1-supabase--remaining-work)  
2. [OAuth sign-in (Google & Apple)](#2-oauth-sign-in-google--apple) — if not finished  
3. [Expo & EAS](#3-expo--eas)  
4. [Apple — Developer & App Store Connect](#4-apple--developer--app-store-connect)  
5. [Google — Play Console](#5-google--play-console)  
6. [RevenueCat](#6-revenuecat)  
7. [Storage (Supabase) — deep dive](#7-storage-supabase--deep-dive)  
8. [QR check-in & tickets](#8-qr-check-in--tickets)  
9. [Apple Wallet passes](#9-apple-wallet-passes)  
10. [Optional: Stripe (paid events)](#10-optional-stripe-paid-events)  
11. [Monitoring & analytics](#11-monitoring--analytics)  
12. [Push & deep links (optional)](#12-push--deep-links-optional)  
13. [Final store submission](#13-final-store-submission)  
14. [Optional: tighten Supabase RLS](#14-optional-tighten-supabase-rls)  

---

## 1. Supabase — remaining work

**Dashboard:** [supabase.com/dashboard](https://supabase.com/dashboard) → select your project.

### 1.1 Creator / host flag (`dalton_verified`)

**Navigate:** Left sidebar **Authentication** → **Users** → click a user row.

**Steps:**

1. Open the user detail (panel or full page depending on UI version).
2. Find **User Metadata** or **Raw User Meta Data** (JSON editor).
3. Add or merge a key: `"dalton_verified": true` (boolean, not string).
4. Save / update user.

**Verify:**

- Sign in as that user in the **app** (dev build recommended).
- Confirm **Create media** / **Create event** entry points match your rules in `src/creator/creatorAccess.ts` (may also need **Premium** after RevenueCat is wired).

**Monitor:** **Authentication** → **Users** — filter by last sign-in; confirm metadata column shows your keys if the UI exposes it.

### 1.2 Logs & health (ongoing)

**Navigate:** **Logs** (or **Reports** → **Logs** in some layouts).

**Use:**

- **API** / **Postgres** — failed queries, RLS errors (`42501`).
- **Auth** — failed logins, OAuth errors.

**Navigate:** **Project Settings** (gear) → **Database** — connection pooling, disk usage.

**Verify:** No sustained error spikes after releases.

### 1.3 Edge Functions (when you add check-in / webhooks)

**Navigate:** **Edge Functions** → deploy function → **Logs** tab for invocations.

**Verify:** HTTP 200 for test calls; secrets under **Project Settings** → **Edge Functions** (secrets).

---

## 2. OAuth sign-in (Google & Apple)

If Step **1e** is not complete, follow **[OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md)** end-to-end. Summary navigation:

### 2.1 Supabase — redirect URLs

**Navigate:** **Authentication** → **URL Configuration**.

**Steps:**

1. **Redirect URLs** — add `dalton-demo://auth/callback` and any `exp://…/--/auth/callback` URLs you use with Expo Go (see OAUTH doc for how to discover them).
2. **Site URL** — can be a placeholder for mobile-only; redirect list matters more for OAuth.

**Verify:** Attempt Google sign-in; callback should return to app without `redirect_uri` errors.

### 2.2 Google Cloud Console

**URL:** [console.cloud.google.com](https://console.cloud.google.com/)

**Navigate:** **APIs & Services** → **OAuth consent screen** (complete steps) → **Credentials** → **Create credentials** → **OAuth client ID** → type **Web application**.

**Steps:**

1. Add **Authorized redirect URIs** exactly as Supabase shows for Google (usually `https://<project-ref>.supabase.co/auth/v1/callback`).
2. Copy **Client ID** and **Client Secret** into Supabase **Authentication** → **Providers** → **Google**.

**Verify:** Supabase provider toggle **enabled**; test sign-in from app.

### 2.3 Apple Developer + Supabase Apple provider

**URL:** [developer.apple.com/account](https://developer.apple.com/account)

**Navigate:** **Certificates, Identifiers & Profiles** → **Identifiers** → your **App ID** → enable **Sign In with Apple**.

**Supabase:** **Authentication** → **Providers** → **Apple** — fill **Services ID**, **Secret Key** (.p8), **Key ID**, **Team ID**, **Bundle ID** per [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple).

**Verify:** Only on **iOS development build** (not Expo Go). Successful sign-in creates user in **Authentication** → **Users**.

---

## 3. Expo & EAS

**Dashboard:** [expo.dev](https://expo.dev) → your account → **Projects** → select **dalton-demo** (or your slug).

### 3.1 Link project locally

**Terminal** (from `expo-app/`):

```bash
npm i -g eas-cli
eas login
eas whoami
```

If the project is not linked: `eas init` (follow prompts).

**Verify:** `eas project:info` shows project ID matching `app.json` → `extra.eas.projectId`.

### 3.2 Environment variables & secrets

**Navigate (web):** Expo dashboard → project → **Environment variables** (or **Secrets** depending on Expo UI version).

**Steps:**

1. Add `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` for **preview** and **production** (and **development** if you use cloud dev builds).
2. When RevenueCat is ready: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`, `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`.
3. Non-public keys (Sentry auth token, etc.) use **Secrets** / non-`EXPO_PUBLIC_` pattern per Expo docs.

**CLI alternative:**

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://...." --environment preview
```

**Verify:** Start an **EAS Build** for `preview`; build logs should show env available to the app (never print secret values in public logs).

### 3.3 Builds

**Navigate:** Expo project → **Builds**.

**Steps:**

1. Trigger: `eas build --profile development --platform ios` (or `android`, or `all`).
2. Open the build page — watch **Queue** → **Running** → **Finished**.
3. Install via QR / artifact link.

**Verify:** App installs; opens; Supabase auth works with EAS-injected env.

### 3.4 `eas.json` profiles

**File:** `expo-app/eas.json`.

**Read:** `development`, `preview`, `production` — channel, auto-submit flags.

**Verify:** Profile names match what you pass to `eas build --profile ...`.

---

## 4. Apple — Developer & App Store Connect

### 4.1 Apple Developer (identifiers & capabilities)

**URL:** [developer.apple.com/account](https://developer.apple.com/account)

**Navigate:** **Certificates, Identifiers & Profiles** → **Identifiers**.

**Steps:**

1. **App IDs** — find or create identifier matching `ios.bundleIdentifier` in `app.json`.
2. Enable capabilities you need: **Sign In with Apple**, **Push Notifications** (if used later), **Associated Domains** (if universal links).
3. **Certificates** — distribution / development for builds (EAS can manage via credentials).

**Verify:** Identifier matches EAS iOS build credentials (Expo prompts or `eas credentials`).

### 4.2 App Store Connect (app record, IAP, agreements)

**URL:** [appstoreconnect.apple.com](https://appstoreconnect.apple.com)

**Navigate:** **Apps** → **+** New App (if needed) → select bundle ID, name, SKU.

**Critical — before paid IAP:**

**Navigate:** **Agreements, Tax, and Banking** (often under your name/account menu or main sidebar).

**Steps:**

1. Accept **Paid Applications Agreement** if you sell digital goods.
2. Complete **Tax** and **Banking** forms.

**Navigate:** Your app → **Features** → **In-App Purchases** (or **Subscriptions**).

**Steps:**

1. Create **subscription group** (if subscriptions).
2. Add products with IDs you will type **identically** into RevenueCat and (if needed) your code.
3. Fill **localization**, **pricing**, **review screenshot** if required.

**Verify:** Products show state **Ready to Submit** or equivalent after metadata complete.

### 4.3 TestFlight

**Navigate:** App → **TestFlight** tab.

**Steps:**

1. After EAS submit or Xcode upload, select the **build**.
2. Add **Internal testing** group; enable build.
3. **External testing** requires Beta App Review for first time.

**Verify:** Testers receive invite; app installs; purchases use **Sandbox** Apple ID (Settings → App Store → Sandbox on device).

---

## 5. Google — Play Console

**URL:** [play.google.com/console](https://play.google.com/console)

### 5.1 Create app & store listing

**Navigate:** **All apps** → **Create app**.

**Steps:**

1. Set **App name**, **default language**, **app type**.
2. Complete **Dashboard** checklist items (privacy policy URL, content rating questionnaire, target audience).

**Verify:** No blocking errors on main dashboard.

### 5.2 Monetization

**Navigate:** **Monetize** → **Products** → **Subscriptions** (or **In-app products**).

**Steps:**

1. Create subscription base plan / product IDs matching RevenueCat.
2. Activate pricing per region.

**Navigate:** **Monetize** → **Payments profile** — complete **Merchant account** if selling.

**Verify:** Products **Active**; linked to correct package name (`android.package` in `app.json`).

### 5.3 Internal testing

**Navigate:** **Release** → **Testing** → **Internal testing**.

**Steps:**

1. Create track; upload AAB from EAS (`eas build --profile preview --platform android` then submit or download).
2. Add testers by email list.

**Verify:** Tester can install from Play link; license tests work per Google’s testing docs.

### 5.4 Data safety

**Navigate:** **App content** → **Data safety**.

**Steps:** Declare data collection (account, photos, etc.) consistent with your privacy policy and actual app behavior.

**Verify:** Form submitted; no policy warnings blocking release.

---

## 6. RevenueCat

**URL:** [app.revenuecat.com](https://app.revenuecat.com)

### 6.1 Project & apps

**Navigate:** **Projects** → create or open project.

**Steps:**

1. **Apps** → **Add app** → **iOS** — enter **Bundle ID** (must match App Store Connect / `app.json`).
2. **Add app** → **Android** — enter **package name** (must match Play Console / `app.json`).

**Verify:** Both apps show **connected** or prompt to upload **credentials** (App Store Connect API key, Google Play service account JSON) — follow RevenueCat’s inline wizard.

### 6.2 Entitlements & offerings

**Navigate:** **Product catalog** → **Entitlements**.

**Steps:**

1. Create entitlement id **`premium`** (required by this repo’s `src/subscriptions/revenueCat.ts`).
2. **Offerings** → attach **App Store** and **Play Store** products to packages under **Current** offering (or your chosen offering).

**Verify:** **Customer lists** → **Test** with a sandbox purchase — entitlements show **premium** active.

### 6.3 SDK keys in app

**Navigate:** **Project settings** → **API keys** (or **App** → SDK keys).

**Steps:**

1. Copy **Apple App Store** public SDK key → `.env` as `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`.
2. Copy **Google Play Store** public SDK key → `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`.
3. Mirror into **EAS** environment variables for builds.

**Verify:** Open **Paywall** screen in a **dev/preview** build (not Expo Go); **Restore** / purchase flow hits RevenueCat (see debug logs if enabled).

### 6.4 Webhook → Supabase `subscription_state`

**Navigate:** **Project settings** → **Integrations** → **Webhooks**.

**Steps:**

1. Add endpoint URL: your **HTTPS** API (Edge Function, Railway, etc.) `POST` receiver.
2. Copy **Authorization** secret RevenueCat provides; verify signature on server per RevenueCat docs.
3. Server upserts `public.subscription_state` (`user_id`, `is_pro`, `entitlement_ids`, `raw`).

**Verify:** After test purchase, row appears/updates in Supabase **Table Editor** → `subscription_state`.

---

## 7. Storage (Supabase) — deep dive

**Navigate:** **Storage** (bucket icon in sidebar).

### 7.1 Create bucket

**Steps:**

1. **New bucket** → name e.g. `media` (or `avatars`, `posts` — match your code).
2. Choose **Public** vs **Private** (private + signed URLs is safer for user content).

**Verify:** Bucket appears in list; default policies are restrictive until you add policies.

### 7.2 Policies

**Navigate:** Bucket → **Policies** (or **Configuration** → **Policies**).

**Steps:**

1. Add **SELECT** / **INSERT** / **UPDATE** / **DELETE** rules for role `authenticated` as needed.
2. Typical pattern: users can `INSERT` only under folder `user_id/...`; read per `visibility` if mirrored in DB.

**Reference:** [ACCESS_MODEL.md](./ACCESS_MODEL.md), [STORAGE.md](./STORAGE.md).

**Verify:** From app, upload a test file; **Storage** → bucket → file appears. **Table Editor** → `media_assets` has matching row if app inserts metadata.

### 7.3 Monitor usage

**Navigate:** **Project Settings** → **Usage** — Storage GB.

**Verify:** Growth matches expectations; set billing alerts if needed.

---

## 8. QR check-in & tickets

**Code reference:** `src/booking/ticketToken.ts`, `BookingQrCode`, [QR_CHECKIN.md](./QR_CHECKIN.md).

### 8.1 Production signing

**Do not** rely on `EXPO_PUBLIC_TICKET_SIGNING_SECRET` alone in production — prefer **server-only** HMAC or JWT.

**Steps:**

1. Deploy **Edge Function** or small API with secret in **Supabase Vault** / env (not in app).
2. Endpoint issues token after confirmed booking; stores `bookings.reference`.
3. **POST /checkin** (or Edge Function route) verifies token, sets `bookings.checked_in_at`.

**Verify:** Staff flow: paste or scan token → server returns success; row updates in **Table Editor** → `bookings`.

### 8.2 Monitor

**Supabase:** **Logs** for Edge Function; **Table Editor** audit via SQL or admin screen.

---

## 9. Apple Wallet passes

**Options:** Third-party (**[Pass2U](https://www.pass2u.net/documentation)** Pass API, PassBuddy-style vendors) **or** self-hosted signing. Longer substeps: [WHAT_NEXT_DETAILED_PENDING.md](./WHAT_NEXT_DETAILED_PENDING.md) (Pass2U section).

### 9.1 Self-hosted (Apple)

**Navigate (Apple Developer):** **Identifiers** → **Pass Type IDs** — create ID.

**Navigate:** **Certificates** — create **Pass Type ID** certificate; download and install on **signing server** (secure).

**Steps:**

1. Backend builds `pass.json`, `manifest.json`, signs with cert + Apple WWDR chain.
2. Serve `.pkpass` over HTTPS; app uses iOS **Add to Wallet** API.

**Reference:** [STORE_RELEASE.md](./STORE_RELEASE.md) (wallet note).

**Verify:** Pass adds to Wallet; barcode scans if you align with check-in system.

### 9.2 Third-party generator

**Steps:**

1. Create account; get API key (server-side only).
2. On **booking confirmed**, server calls API with attendee/event fields.
3. Return pass URL or file to app.

**Verify:** Same as above; review vendor dashboard for pass delivery errors.

---

## 10. Optional: Stripe (paid events)

**Reference:** [INTEGRATIONS.md](./INTEGRATIONS.md).

**Dashboard:** [dashboard.stripe.com](https://dashboard.stripe.com)

**Navigate:** **Developers** → **API keys**; **Webhooks** → **Add endpoint**.

**Steps:**

1. Server creates Checkout Session; webhook updates `bookings.payment_status`.
2. Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` **only** on server.

**Verify:** Test mode successful payment → webhook received → DB updated.

---

## 11. Monitoring & analytics

**Reference:** [MONITORING_AND_ANALYTICS.md](./MONITORING_AND_ANALYTICS.md).

### 11.1 Sentry (example)

**URL:** [sentry.io](https://sentry.io)

**Navigate:** **Projects** → **Create project** → React Native.

**Steps:**

1. Follow wizard for **DSN**; add SDK to app in **dev build** only first.
2. Upload source maps via EAS / Sentry wizard.

**Verify:** Throw test error in dev; issue appears in Sentry within minutes.

### 11.2 PostHog / Amplitude (example)

**Navigate:** Project → **Activity** / **Live events**.

**Steps:** Initialize SDK with project key from dashboard; fire test `screen_view` or custom event.

**Verify:** Event visible in live stream.

---

## 12. Push & deep links (optional)

**Reference:** [INTEGRATIONS.md](./INTEGRATIONS.md).

**Expo:** [expo-notifications](https://docs.expo.dev/push-notifications/overview/) — configure **FCM** (Android) and **APNs** (iOS) in EAS.

**Navigate:** Expo project → credentials for push.

**Verify:** Send test push from Expo tool or FCM console.

---

## 13. Final store submission

**Reference:** [STORE_RELEASE.md](./STORE_RELEASE.md).

### 13.1 Pre-submit (app repo)

**Checklist:**

- `app.json`: version, icons, splash, `ios.bundleIdentifier`, `android.package`.
- Privacy usage strings (camera, photos, etc.) match `app.json` plugins.
- No secrets committed.

### 13.2 Apple

**Navigate:** App Store Connect → app → **App Store** tab → prepare **version**, **screenshots**, **description**, **privacy nutrition labels**, **support URL**.

**Terminal:**

```bash
eas build --profile production --platform ios
eas submit --platform ios --latest
```

**Verify:** Build processing in ASC; submit for review.

### 13.3 Google

**Navigate:** Play Console → **Release** → **Production** (or **Open testing**).

**Terminal:**

```bash
eas build --profile production --platform android
eas submit --platform android --latest
```

**Verify:** Release dashboard shows rollout; pre-launch report clean.

---

## 14. Optional: tighten Supabase RLS

**Reference:** [ACCESS_MODEL.md](./ACCESS_MODEL.md).

**Navigate:** **SQL Editor** or migrations — add policies for tables still open (`events`, `organizations`, `conversations`, etc. if you enabled RLS on them).

**Verify:** Run tests as two different users; confirm cross-tenant reads fail as intended.

---

## Master checklist (copy to your notes)

| # | Task | System |
|---|------|--------|
| 1 | `dalton_verified` on test users | Supabase Auth |
| 2 | OAuth redirect URLs + providers | Supabase + Google + Apple |
| 3 | EAS env vars + successful preview build | Expo |
| 4 | App record + agreements + IAP products | App Store Connect |
| 5 | App + IAP + Data safety | Play Console |
| 6 | RevenueCat apps + `premium` + keys + webhook | RevenueCat + API |
| 7 | Storage bucket + policies + `media_assets` | Supabase |
| 8 | Check-in API + DB updates | Supabase Edge / API |
| 9 | Wallet pass integration | Apple / vendor |
| 10 | Sentry (and optional analytics) | Third-party |
| 11 | Production EAS build + submit | Expo + stores |

---

*Update this playbook when your bundle IDs, bucket names, or vendor choices are final.*
