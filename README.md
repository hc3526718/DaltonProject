# Dalton Demo (Expo)

By default the app runs a **native** app shell that mirrors the static HTML flows:

- **Tabs** (Community, Media, Sponsors, Events, Profile) — see `src/navigation/AppNavigator.tsx`.
- **Stacks** per tab map to the numbered HTML mockups (feed, messages, media library / player, event booking, profile settings, sponsors, onboarding, The Dalton Grant Academy signup).
- **Design tokens** — `src/designSystem.ts`.
- **Typography** — Bebas Neue + DM Sans via `@expo-google-fonts/*`, loaded in `App.tsx` (`loadAppFonts.ts`) to align with the HTML mockups.
- **HTML-derived content** — e.g. `src/data/upcomingEventsFromHtml.ts` (from `13-Upcoming Events.html`), community feed posts from `7-Community Feed.html`.
- **Demo hub** — Profile → “Demo flows hub”, or Community stack → `DemoHub` (same idea as `index.html`).

`The Dalton Grant Academy` (`32-…`) is **splash + create account** only; **Continue** switches to the **Community** tab (feed).

## Post report → email (moderation)

The Edge Function **`send-post-report-email`** is in `supabase/functions/send-post-report-email/`. It accepts Supabase **Database Webhook** payloads for **`post_reports` INSERT** and sends mail through **[Resend](https://resend.com)**.

1. **Resend**: create an API key. With **`onboarding@resend.dev`** as the sender, Resend only delivers to addresses allowed by your Resend plan (verify a **domain** to mail arbitrary recipients).
2. **Supabase** (Dashboard → **Edge Functions** → **send-post-report-email** → **Secrets**), set:
   - `RESEND_API_KEY`
   - `REPORT_NOTIFY_EMAIL` — moderator inbox
   - `REPORT_WEBHOOK_SECRET` — long random string (use the same value in the webhook header below)
   - Optional: `RESEND_FROM_EMAIL` — otherwise `Dalton Reports <onboarding@resend.dev>`
3. **Database webhook** (Dashboard → **Database** → **Webhooks**): **Table** `public.post_reports`, event **Insert**. **URL**:
   `https://<project-ref>.supabase.co/functions/v1/send-post-report-email`  
   (for this project: `https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/send-post-report-email`).
4. **HTTP headers** on the webhook (Edge gateway + your shared secret):
   - `Authorization: Bearer <anon key from Project Settings → API>`
   - `apikey: <same anon key>` (required by the functions gateway)
   - `x-report-secret: <same as REPORT_WEBHOOK_SECRET>`
   - `Content-Type: application/json`

**Where `REPORT_WEBHOOK_SECRET` comes from:** nowhere automatic — **you create it**. Use a long random string (e.g. `openssl rand -hex 32` or a password generator). Put the **same** value in (1) Supabase Edge Function secret `REPORT_WEBHOOK_SECRET` and (2) webhook HTTP header `x-report-secret`. It is unrelated to Resend’s API key.

Local Resend SDK smoke test (Node only — **not** bundled in the app): from `expo-app/`, set `RESEND_API_KEY` (or `EXPO_PUBLIC_RESEND_API_KEY`) in `.env`, replace any `re_xxxxxxxxx` placeholder, then run `npm run test:resend`. See `scripts/test-resend-email.mjs`.

Redeploy after edits: `supabase functions deploy send-post-report-email` from the repo root (requires [Supabase CLI](https://supabase.com/docs/guides/cli) and `supabase link`).

To load the **HTML mockups** in a **WebView** instead, set `EXPO_PUBLIC_USE_WEBVIEW_DEMO=1` (see `.env.example`); implementation in `src/WebDemoApp.tsx`.

## Backend roadmap docs

Product/backend planning and setup checklists live in **`docs/`** (auth, access model, monetization, storage, Stripe, QR check-in, RevenueCat, EAS release, UI wiring, secrets). **Implementation order:** **`docs/NEXT_STEPS.md`**. SQL sketch: **`backend/schema.sql`**.

## Expo SDK 54

- **Expo SDK 54** · **React Native 0.81** · **React 19** — use **Expo Go** that lists SDK 54, or a **development build** (`eas build`).
- **Node.js** — use **20.19+** (Expo recommendation).
- **Android HTTP (WebView demo)** — cleartext traffic is enabled via `expo-build-properties` in `app.json` (not the deprecated `android.usesCleartextTraffic` field).

## Run with Expo Go

1. From the **repo root** (parent of `expo-app/`):

   ```bash
   npx --yes serve -l tcp://0.0.0.0:5173
   ```

2. From **`expo-app/`**:

   ```bash
   npm install
   npx expo start
   ```

3. Scan the QR code. Enter your PC’s IP and port (e.g. `192.168.1.42:5173`) on first launch, or set `EXPO_PUBLIC_DALTON_WEB_URL` in `.env` (see `.env.example`).

## Why not “convert all HTML to React Native”?

- There is **no automatic** HTML → RN converter that preserves layout and behavior.
- Rebuilding **32** screens by hand means **new components**, **navigation**, **state**, and **assets** — it’s a **full app project**, not a format change.
- The **WebView** approach is the standard way to ship HTML/CSS demos inside Expo until you **incrementally** replace screens with RN.

If you want to **start** a real RN migration, do it **one flow at a time** (e.g. auth only) with **React Navigation**, and keep the rest in WebView until migrated.

## Store builds

Use **EAS Build** (`production` profile → **store** distribution on iOS, **AAB** on Android). Point `EXPO_PUBLIC_DALTON_WEB_URL` at **HTTPS** for production.

**TestFlight (install on device without Metro):** step-by-step checklist in **`docs/TESTFLIGHT.md`** (`eas build --profile production --platform ios` → `eas submit --platform ios --latest` → install from the **TestFlight** app).
