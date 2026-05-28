# Detailed setup guide — from Step 2 to store-ready

This document expands **[WHAT_NEXT.md](./WHAT_NEXT.md)** from **Step 2 onward** into **simple stages** with the main actions you need—not every edge case.

**You said is already done**

1. **Supabase** — schema, RLS baseline, onboarding fields, etc. (e.g. via MCP).
2. **Build / UI** — app looks good.
3. You are comparing **PassBuddy** (or similar) vs **building Apple Wallet passes yourself** — see **[§ PassBuddy vs in-app Wallet](#passbuddy-vs-signing-wallet-passes-in-your-own-stack)** below.

**Still to do (this guide)** — Steps 2–8 from WHAT_NEXT, plus context on OAuth (Step 1e), EAS, and stores.

**Related docs** (open when a step points to them): [BACKEND_AUTH.md](./BACKEND_AUTH.md), [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md), [STORAGE.md](./STORAGE.md), [REVENUECAT.md](./REVENUECAT.md), [MONETIZATION.md](./MONETIZATION.md), [QR_CHECKIN.md](./QR_CHECKIN.md), [STORE_RELEASE.md](./STORE_RELEASE.md), [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md), [MONITORING_AND_ANALYTICS.md](./MONITORING_AND_ANALYTICS.md), [INTEGRATIONS.md](./INTEGRATIONS.md), [NEXT_STEPS.md](./NEXT_STEPS.md).

---

## PassBuddy vs signing Wallet passes in your own stack

**What you’re comparing**

- **PassBuddy-style service:** User (or your app) sends ticket / event data to a **third party**; they generate a **signed** `.pkpass` (or a hosted flow) that the user adds to **Apple Wallet**.
- **Your own stack:** You run a **Pass Type ID**, **certificates**, and **signing code** (often a small **Node/Python** service or **Supabase Edge Function**) that builds and signs passes; the app downloads the pass and calls the system **Add to Wallet** UI.

### Is PassBuddy easier?

**Usually yes, for the first version.**

| Area | PassBuddy / similar | Your own signing |
|------|---------------------|------------------|
| Apple Pass Type ID + certs + WWDR | Often **abstracted** by the vendor | **You** create and renew certs, secure the signing key |
| Backend code | **Integrate their API** + webhooks | Implement pass JSON, manifest, signature, MIME delivery |
| Time to first working pass | **Shorter** if their docs fit your flow | **Longer** (Apple setup + server) |
| Ongoing cost | Their **pricing** per pass / month | Infra + your time; no per-pass SaaS fee |
| Control (revoke, update fields, branding) | **Limited** to what they expose | **Full** control |
| Compliance / data | Ticket data leaves your infra to them | Stays on **your** servers if you want |

### Does “doing it in the app” make QR faster or Wallet instant?

**Mostly separate concerns in your app:**

- **QR codes** in Dalton (see [QR_CHECKIN.md](./QR_CHECKIN.md)) encode a **ticket token** for **staff scan / check-in**. That can be generated **on-device or from your API** in milliseconds. PassBuddy vs self-sign **does not** inherently make the QR faster—whichever path issues the **booking + token** is what matters.
- **Adding to Wallet** always needs a **valid signed `.pkpass`** (or Apple’s modern pass APIs). Whether that file was signed by **PassBuddy** or **your server**, the user taps “Add” and iOS shows the sheet—**perceived speed** is usually “as soon as the file is ready.”
- **PassBuddy** adds **one network round-trip** (your app → their API → pass file or URL). If their API is fast, that’s often **under a second**. Your own signer can be equally fast if hosted close to users.

**Summary:** PassBuddy is **not** inherently slower for “immediate” Wallet in normal conditions; your own stack is **not** automatically faster for QR. Choose based on **effort, cost, control, and where sensitive data may go**.

### Recommendation

- **MVP / few events / validate product:** PassBuddy (or similar) can be **reasonable** if you accept vendor dependency and pricing.
- **Scale, strict data residency, custom pass updates:** Plan to move to **your own signing** (or a **B2B pass platform** with SLAs) and keep one **source of truth** in Supabase (`bookings`, etc.).

Whatever you pick, **production check-in** should still **verify tokens on the server** ([QR_CHECKIN.md](./QR_CHECKIN.md))—don’t trust only the pass barcode without backend validation.

---

## Stage 0 — Quick confirm (Step 1 & 1e)

Do this if anything below fails (auth, OAuth, builds).

| Stage | What to verify |
|-------|----------------|
| **0.1** | **`.env`** in `expo-app/` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`). |
| **0.2** | **EAS** (if you use cloud builds): same vars as secrets or project env — [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md). |
| **0.3** | **OAuth (optional but recommended):** [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md) — Supabase redirect URLs, Google Cloud, Apple Developer, **dev build** for Sign in with Apple. |
| **0.4** | **Expo account** linked: `eas whoami`, project has `eas.json` profiles. |

---

## Stage 1 — Step 2: Auth metadata (creator / host flags)

**Goal:** Test users who should use **Create media** / **Create event** are allowed by the app logic.

| Step | Action |
|------|--------|
| 1.1 | Read [BACKEND_AUTH.md](./BACKEND_AUTH.md) — **Creator / host flags** section. |
| 1.2 | In **Supabase** → **Authentication** → select a user → **Raw User Meta Data** → add JSON key: `"dalton_verified": true` (boolean). |
| 1.3 | Repeat for each **test** coach/host account. |
| 1.4 | In the app (signed in as that user), confirm **creator** flows appear as expected (`canCreateVerifiedContent` in `src/creator/creatorAccess.ts` also considers **Premium** / RevenueCat when wired). |
| 1.5 | **Later:** Automate via **admin tool** or **Edge Function** (never expose service role in the app). |

**Done when:** At least one Supabase user can reach creator UI after metadata + (if required) subscription rules.

---

## Stage 2 — Step 3: Storage (uploads)

**Goal:** Files go to **Supabase Storage**; **metadata** rows exist in **`media_assets`**.

| Step | Action |
|------|--------|
| 2.1 | Read [STORAGE.md](./STORAGE.md) — pattern: binary in bucket, row in Postgres. |
| 2.2 | Supabase → **Storage** → **New bucket** (e.g. `media` or split `images` / `videos`). Decide **public vs private**. |
| 2.3 | Add **Storage policies** so authenticated users can upload/read according to [ACCESS_MODEL.md](./ACCESS_MODEL.md) (e.g. owner-only write, public read for public assets). |
| 2.4 | Align **path convention** with `media_assets.storage_path` in `backend/schema.sql`. |
| 2.5 | **App:** Ensure upload UI uses `supabase.storage` and **inserts** into `media_assets` after upload (wire if not already). |
| 2.6 | Test: upload from a **dev build** (image picker needs real device for best test). |

**Done when:** One file uploads, appears in bucket, and has a `media_assets` row linked to the user.

---

## Stage 3 — Step 4: RevenueCat + store billing (high level)

**Goal:** In-app purchases / subscriptions drive **`premium`** (and later more entitlements); **server** can mirror truth.

### Part A — Apple & Google product setup (human-heavy)

| Step | Action |
|------|--------|
| 3.1 | **Apple:** [App Store Connect](https://appstoreconnect.apple.com/) — create app record (if missing), **Subscriptions** or **In-App Purchases**, product IDs you will reference in RevenueCat. Complete **Agreements, Tax, Banking** when selling paid digital goods. |
| 3.2 | **Google:** [Play Console](https://play.google.com/console/) — create app, **Monetize** → **Products** (subscriptions / one-time). Complete **Merchant account** and **Payments profile** for paid apps. |
| 3.3 | Match **bundle ID** (iOS) and **application ID** (Android) to `app.json` / EAS — [STORE_RELEASE.md](./STORE_RELEASE.md). |

### Part B — RevenueCat

| Step | Action |
|------|--------|
| 3.4 | [RevenueCat](https://www.revenuecat.com/) — new project → add **iOS** and **Android** apps with **same** bundle/package IDs. |
| 3.5 | Create **Entitlement** id **`premium`** (matches `src/subscriptions/revenueCat.ts`). |
| 3.6 | Attach **App Store** and **Play Store** products to that entitlement (Offerings as you prefer). |
| 3.7 | Copy **SDK API keys** (public) into `.env`: `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`, `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`. |
| 3.8 | Add same keys to **EAS** for builds — [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md). |
| 3.9 | **Test only** in **development** or **preview** build — **not Expo Go** ([REVENUECAT.md](./REVENUECAT.md)). |
| 3.10 | **Webhook (production truth):** RevenueCat → your API → upsert `subscription_state` in Supabase ([REVENUECAT.md](./REVENUECAT.md), [MONETIZATION.md](./MONETIZATION.md)). |

**Done when:** Sandbox / test purchase unlocks entitlement in the SDK and (when webhook is live) `subscription_state` updates.

---

## Stage 4 — Step 5: Apple Wallet, QR check-in, PassBuddy choice

**Goal:** Attendees have a **scannable** ticket; optional **Wallet pass**; **staff** can verify.

| Step | Action |
|------|--------|
| 4.1 | **QR / token:** Read [QR_CHECKIN.md](./QR_CHECKIN.md). Production = **server** signs or validates tokens; `EXPO_PUBLIC_TICKET_SIGNING_SECRET` is for **demo** alignment only. |
| 4.2 | Implement or deploy **`POST /checkin`** (or Edge Function) that verifies token and sets `bookings.checked_in_at`. |
| 4.3 | **Wallet pass:** If using **PassBuddy** — integrate their API after booking confirmed; pass returned URL/file into iOS “Add to Wallet” flow. If **self-hosted** — follow Apple Passbook docs + [STORE_RELEASE.md](./STORE_RELEASE.md) note on pass signing. |
| 4.4 | **STORE_RELEASE** wallet-related preflight: certificates, Pass Type ID when you own signing — [STORE_RELEASE.md](./STORE_RELEASE.md). |

**Done when:** Booking → QR shows; staff path can validate; Wallet path works for your chosen integration.

---

## Stage 5 — Step 6: Native modules (Rive, image picker)

| Step | Action |
|------|--------|
| 5.1 | **Rive:** Requires **dev client** or **EAS build** — not Expo Go. See [NEXT_STEPS.md](./NEXT_STEPS.md), [STORE_RELEASE.md](./STORE_RELEASE.md). |
| 5.2 | **Image picker:** `app.json` already has plugin permissions; test **camera/photos** on a **physical device** build. |
| 5.3 | Run `eas build --profile development` (or `preview`) when adding/changing native deps. |

**Done when:** Animations and uploads work on a real install, not only simulator/web.

---

## Stage 6 — Step 7 (optional): Monitoring & analytics

| Step | Action |
|------|--------|
| 6.1 | Read [MONITORING_AND_ANALYTICS.md](./MONITORING_AND_ANALYTICS.md). |
| 6.2 | Pick **one** crash tool (e.g. Sentry) and **one** analytics tool (e.g. PostHog). |
| 6.3 | Add SDKs in a **dev build**; wire EAS secrets for API keys; define a small list of event names. |
| 6.4 | [INTEGRATIONS.md](./INTEGRATIONS.md) for push/deep links when you reach that phase. |

**Done when:** You can see crashes (or errors) and core events for one release.

---

## Stage 7 — Step 8: Store release (App Store + Play)

| Step | Action |
|------|--------|
| 7.1 | Work [STORE_RELEASE.md](./STORE_RELEASE.md) end-to-end: icons, splash, **privacy strings**, screenshots, **support URL**, data safety (Play), App privacy (Apple). |
| 7.2 | `eas build --profile preview` → internal testing (TestFlight / Play internal). |
| 7.3 | `eas submit` when ready; fix store rejections (metadata, permissions, IAP config). |

**Done when:** App is in review or live, with agreements and IAP aligned to RevenueCat.

---

## Stage 8 — “Before first EAS build” sanity checklist

Use this as a **single pass** before you rely on a cloud build.

| Area | Check |
|------|--------|
| **Expo** | Logged in; `eas.json` profiles make sense. |
| **IDs** | `ios.bundleIdentifier`, `android.package` final in `app.json`. |
| **Secrets** | Supabase, RevenueCat (if testing purchases), ticket secret, any analytics — [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md). |
| **Plugins** | `app.json` lists what you use (`expo-font`, `expo-image-picker`, `expo-web-browser`, `expo-apple-authentication`, etc.). |
| **Smoke test** | Auth → tabs → booking QR path → creator (if applicable) on a **device** build. |

---

## Suggested order (summary)

1. **Stage 0** — env + OAuth if needed  
2. **Stage 1** — `dalton_verified` metadata  
3. **Stage 2** — Storage + `media_assets`  
4. **Stage 3** — Store products → RevenueCat → env → webhook → test on dev build  
5. **Stage 4** — QR server verify + Wallet (PassBuddy **or** own signing)  
6. **Stage 5** — Confirm native modules on device builds  
7. **Stage 6** — Optional Sentry/analytics  
8. **Stage 7** — Store listings and submit  

---

## After each stage

- Tick items in [WHAT_NEXT.md](./WHAT_NEXT.md) or [NEXT_STEPS.md](./NEXT_STEPS.md) for your own tracking.
- Prefer **one vertical slice** (e.g. “upload one image end-to-end”) before opening the next big area.

---

*Last aligned with WHAT_NEXT.md structure — adjust product-specific copy (PassBuddy API details, exact product IDs) as you lock vendors.*
