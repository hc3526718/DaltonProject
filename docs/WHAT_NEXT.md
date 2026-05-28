# What to do next — Dalton Expo app (step by step)

Follow sections in order unless you are only fixing one area. All paths are relative to the `**expo-app/**` folder unless noted.

**Security:** Never commit real API keys or paste them into files that are tracked by git. Use a local `**.env`** file (already gitignored) or **EAS Secrets** for builds.

**In-depth guide (Step 2 → store-ready):** [SETUP_FROM_STEP2_DETAILED.md](./SETUP_FROM_STEP2_DETAILED.md) — staged checklist, RevenueCat/billing outline, **PassBuddy vs own Wallet signing**, QR vs Wallet timing.

**Remaining work — dashboard playbook:** [REMAINING_TASKS_PLAYBOOK.md](./REMAINING_TASKS_PLAYBOOK.md) — step-by-step navigation for Supabase, Expo/EAS, Apple, Google Play, RevenueCat, Storage, QR/Wallet, monitoring, store submit.

**Pending work — long-form substeps (incl. Pass2U Wallet option):** [WHAT_NEXT_DETAILED_PENDING.md](./WHAT_NEXT_DETAILED_PENDING.md)

### Supabase database — already applied (this project)

Migrations on the linked Supabase project: `**dalton_core_schema`**, `**dalton_auth_handle_new_user**`, `**dalton_rls_baseline_authenticated**`, `**dalton_profile_onboarding_fields**` (onboarding columns on `profiles`: `first_name`, `last_name`, `persona_role`, `sports`, `discovery_source`, `onboarding_completed_at`).

**Optional later:** tighten RLS on `organizations`, `organization_memberships`, `events`, `conversations`, `conversation_participants`, `subscription_state` per [ACCESS_MODEL.md](./ACCESS_MODEL.md). **New / other Supabase project:** run `backend/schema.sql` and `backend/handle_new_user.sql` in the SQL Editor (or equivalent migrations); see [DATABASE_SCHEMA_SOURCE.md](./DATABASE_SCHEMA_SOURCE.md) if you also have CoachCraft SQL.

**Next:** [Step 1 — Connect this folder to Supabase](#step-1--connect-this-folder-to-supabase-local-env), then [1e — Apple & Google sign-in](#1e--apple--google-sign-in-supabase--app). **Full OAuth walkthrough:** [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md).

---

## Step 1 — Connect this folder to Supabase (local env)

The app reads `**EXPO_PUBLIC_SUPABASE_URL`** and `**EXPO_PUBLIC_SUPABASE_ANON_KEY**` (see `src/lib/env.ts`).

### 1a — Create your local `.env` file

- In `**expo-app/**`, copy `**.env.example**` to `**.env**` (PowerShell from `expo-app`: `Copy-Item .env.example .env`).
- Open `**.env**` in an editor.

### 1b — Fill in the two Supabase variables

- In Supabase: **Project Settings** (gear) → **API**.
- Copy **Project URL** → `EXPO_PUBLIC_SUPABASE_URL=<paste>` (shape: `https://xxxx.supabase.co`, no trailing slash).
- Copy the **anon** / **publishable** key the dashboard labels for **client** use → `EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste>`.
- Save `**.env`**.

### 1c — Restart Expo so env loads

- Stop Expo (Ctrl+C), then from `**expo-app/**`: `npx expo start` (add `--clear` if the app still behaves like demo-only).
- Sign in with a user in **Supabase Auth** when testing live data.

### 1d — EAS builds (preview / production)

- Set the same two variables for cloud builds: `eas secret:create` or **EAS Environment Variables** in the Expo dashboard. See [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md).

**Important:** Rotate the anon key in Supabase if it was ever exposed.

---

### 1e — Apple & Google sign-in (Supabase + app)

**Use the step-by-step guide:** [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md) (redirect URLs, Google Cloud, Apple Developer, Expo Go vs dev build, troubleshooting).

**Summary:**

- Scheme `**dalton-demo`** in `app.json`; OAuth return path is `auth/callback` → `dalton-demo://auth/callback` in dev/production builds.
- `**npx uri-scheme list**` often prints *“Could not find any native URI schemes”* if you have no `ios`/`android` folders — that is normal. Add redirect URLs from the guide instead (including `exp://…/--/auth/callback` variants when using Expo Go for Google).
- **Google:** Supabase provider + Google Cloud **Web** OAuth client; allow Supabase’s `…/auth/v1/callback` in Google; add app deep links to Supabase **Redirect URLs**.
- **Apple:** Not available in **Expo Go**; requires a **development build** (`expo run:ios` or EAS). Configure Apple Developer + Supabase Apple provider per the guide.
- After plugin/scheme changes, rebuild native apps (`npx expo prebuild` if you commit native projects, or **EAS Build**).

---

## Step 2 — Auth metadata the app understands

1. Read [BACKEND_AUTH.md](./BACKEND_AUTH.md).
2. For **creator** screens (upload media / create event), users need `**dalton_verified: true*`* in **raw user metadata** (and Premium logic via RevenueCat when wired).
3. In Supabase **Authentication** → user → **Raw User Meta Data**, add e.g.
  `"dalton_verified": true`  
   for test accounts (or automate via admin tool later).

---

## Step 3 — Storage (uploads)

1. Follow [STORAGE.md](./STORAGE.md) to create buckets (e.g. media) and **storage** policies.
2. Later, wire the app’s upload UI to `supabase.storage` and insert rows into `**media_assets`** as in `schema.sql`.

---

## Step 4 — RevenueCat (subscriptions)

1. Follow [REVENUECAT.md](./REVENUECAT.md) and [MONETIZATION.md](./MONETIZATION.md).
2. Add to `**.env**` (and EAS secrets for builds):
  `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS=...`  
   `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID=...`
3. Test only in a **development / preview build**, not Expo Go.

---

## Step 5 — Apple Wallet & QR check-in

1. [STORE_RELEASE.md](./STORE_RELEASE.md) — Pass Type ID, certificates.
2. [QR_CHECKIN.md](./QR_CHECKIN.md) — server verification of ticket tokens.

---

## Step 6 — Native modules (Rive, image picker)

1. **Rive** needs a **dev client** or **EAS build**, not Expo Go — see [NEXT_STEPS.md](./NEXT_STEPS.md).
2. **expo-image-picker** — permissions are in `app.json`; test on a real device build.

---

## Step 7 — Optional: monitoring & analytics

1. [MONITORING_AND_ANALYTICS.md](./MONITORING_AND_ANALYTICS.md) — Sentry, PostHog, etc.
2. [INTEGRATIONS.md](./INTEGRATIONS.md) — push, deep links.

---

## Step 8 — Store release (when ready)

1. Work through [STORE_RELEASE.md](./STORE_RELEASE.md) end to end (bundle IDs, privacy strings, screenshots, support URL, etc.).

---

## Before your first EAS build (checklist)

### Account & project

- [Expo](https://expo.dev) account; project linked (`eas init` if needed).
- `eas.json` profiles reviewed (`development`, `preview`, `production`).
- **Bundle identifier** (iOS) and **application ID** (Android) finalized in `app.json` / `app.config`.

### Secrets & env (EAS)

- `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` set as EAS secrets or env if the build must talk to Supabase.
- `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `_ANDROID` if testing purchases in that build.
- Any other keys from [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md) you need.

### Native / config

- Plugins in `app.json`: `expo-font`, `expo-build-properties`, `expo-image-picker`, `expo-web-browser`, `expo-apple-authentication`, and native modules you use (e.g. Rive) via prebuild.
- iOS deployment target meets dependency minimums (e.g. 15.1+ where set).
- Build with `**development`** or `**preview**` profile—not Expo Go—for native modules.

### Backend

- Storage buckets if testing uploads.

### After install (smoke test)

- Boot → login with a **Supabase** user (email/password or Apple/Google after [1e](#1e--apple--google-sign-in-supabase--app)).
- Complete or skip onboarding (demo users skip); land on **Community** tab.
- Tabs work; no red error screens.
- Creator flows on device if testing pickers.
- RevenueCat sandbox if enabled.

### Production build later

- Full [STORE_RELEASE.md](./STORE_RELEASE.md) checklist.
- Monitoring if you promise it in the store listing.

---

## Quick reference — env vars this app reads


| Variable                                 | Purpose                             |
| ---------------------------------------- | ----------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`               | Supabase project URL                |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`          | Supabase public/anon (client) key   |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`     | RevenueCat iOS SDK key              |
| `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID` | RevenueCat Android SDK key          |
| `EXPO_PUBLIC_API_BASE_URL`               | Optional custom API                 |
| `EXPO_PUBLIC_TICKET_SIGNING_SECRET`      | QR demo / must match server in prod |


Template: copy from `**.env.example`** in `expo-app/`.

---

**End-to-end order:** `.env` + redirect URLs + OAuth providers → restart Expo / rebuild native → auth metadata for creators → Storage → RevenueCat → EAS secrets → preview build → store when checklist is green.