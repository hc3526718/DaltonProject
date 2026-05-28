# What’s next — detailed instructions (pending work)

This expands **[WHAT_NEXT.md](./WHAT_NEXT.md)** into **actionable substeps** for work that is typically **not finished** after the first Supabase + app wiring pass. Treat it as a **checklist**: skip sections you have already verified.

**Companion:** [REMAINING_TASKS_PLAYBOOK.md](./REMAINING_TASKS_PLAYBOOK.md) (where to click in each dashboard), [SETUP_FROM_STEP2_DETAILED.md](./SETUP_FROM_STEP2_DETAILED.md) (stages + Pass vendor comparison).

---

## Pass2U ([documentation](https://www.pass2u.net/documentation)) for Apple Wallet–style passes

### Can you implement it?

**Yes**, as a **third-party pass issuer** (similar idea to PassBuddy in [SETUP_FROM_STEP2_DETAILED.md](./SETUP_FROM_STEP2_DETAILED.md)): Pass2U hosts **models**, signs **`.pkpass`** (or gives you **download URLs**), and exposes a **REST Pass API 2.0** so your backend can **create/update** passes without you running Apple’s Pass Type ID signing stack yourself.

### Requirements (from Pass2U’s docs)

1. **Enterprise / API access** — API is described as for **Enterprise Plan** users; you **apply for an API key** via Pass2U support (`contact@micromacro.com.tw`) with account info, pass style (e.g. event ticket), distribution channel (e.g. app), and whether you use their checkout/redemption.
2. **Dashboard workflow** — Create a **Model** (layout, dynamic fields with **unique keys**, barcode type), publish, note **`modelId`**.
3. **Authentication** — All calls send header **`x-api-key: <32-char base64 key>`**. **Never put this key in the Expo app** — only your **server** (Supabase **Edge Function**, small API, etc.).

### Typical integration pattern (Dalton + mobile)

| Layer | What you do |
|-------|----------------|
| **Backend** | After a **confirmed booking** (`bookings` row), `POST https://api.pass2u.net/v2/models/{modelId}/passes` with JSON body (barcode message = your **ticket token** or Pass2U-generated code per docs), header `x-api-key`. Store returned **`passId`** on the booking or a `wallet_passes` table. |
| **Download** | Pass2U documents a public download pattern: `https://www.pass2u.net/d/{passId}` and a **Get pkpass file** API — your server returns either a **short-lived signed URL** to your own endpoint that proxies the `.pkpass`, or the app opens the Pass2U URL in **Safari** / **`SFSafariViewController`** / **`Linking.openURL`** (user adds to Wallet from Apple’s flow). |
| **App (React Native / Expo)** | Call **your** API with the user’s session; receive a **URL or base64 .pkpass**; use **`expo-file-system`** + **`Sharing`** / platform-specific **PassKit** (often via a **native module** or **expo pass** community solutions) — exact API depends on what Pass2U returns; many teams use **“open HTTPS page → user taps Add”** for MVP. |
| **Check-in** | Still **verify the booking token on your server** ([QR_CHECKIN.md](./QR_CHECKIN.md)) — the pass is a **presentation** layer; **trust** comes from your DB + HMAC/JWT, not from Pass2U alone. |

### Pass2U vs self-signed Apple passes

| | Pass2U | Your own Pass Type ID + signer |
|--|--------|----------------------------------|
| **Apple cert / WWDR** | Handled by Pass2U | You create, renew, secure signing material |
| **Time to MVP** | Usually **faster** after API approval | Longer engineering |
| **Cost / control** | Their **pricing** + model limits | Infra + time; **full** control |
| **Data residency** | Ticket/personal fields go to **Pass2U** per API payload | Can stay entirely on **your** Supabase |

**Recommendation:** Pass2U is **valid** for MVP event tickets if you accept vendor dependency and support turnaround for the API key. Align **barcode `message`** with whatever **staff scanners** validate ([QR_CHECKIN.md](./QR_CHECKIN.md)).

---

## Step 1 — Anything still open (local + EAS)

### 1a — `.env` (if not done)

1. In `expo-app/`, copy `.env.example` → `.env`.
2. Supabase → **Project Settings** → **API** → paste **URL** and **anon** key into `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. `npx expo start` (add `--clear` if the app caches old env).

### 1b — EAS mirrors (if you build in the cloud)

1. [expo.dev](https://expo.dev) → your project → **Environment variables** (or use `eas env:create` from [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md)).
2. For **each** profile you use (`development`, `preview`, `production`), add at least the same `EXPO_PUBLIC_SUPABASE_*` keys.
3. Run `eas build --profile preview --platform ios` (or your profile) and confirm the build logs show env injection (not the values).

### 1c — OAuth (if not done)

Follow **[OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md)** completely: Supabase redirect URLs, Google Web client + Supabase provider, Apple Services ID + `.p8` + Supabase Apple provider, **dev build** for Apple.

**Verify:** New user appears in Supabase **Authentication** → **Users** after each provider test.

---

## Step 2 — Auth metadata (creators / hosts)

1. Read **[BACKEND_AUTH.md](./BACKEND_AUTH.md)** (creator flags).
2. Supabase → **Authentication** → user → **Raw User Meta Data** → add **`"dalton_verified": true`** (boolean) for each test host/coach.
3. Open the app as that user → confirm **Create media** / **Create event** visibility matches **`src/creator/creatorAccess.ts`** (may also need **RevenueCat `premium`** when Step 4 is live).

---

## Step 3 — Storage (uploads)

1. Read **[STORAGE.md](./STORAGE.md)**.
2. Supabase → **Storage** → **New bucket** (e.g. `media`) → choose **public vs private** (private + signed URLs is safer for user media).
3. **Policies** — authenticated users can upload under `auth.uid()/…`; reads match your product (public vs owner).
4. **App** — wire pickers to `supabase.storage.from('media').upload(...)` then **insert** `media_assets` (`owner_id`, `storage_path`, `kind`, …) per `backend/schema.sql`.
5. Test on a **real device build** (camera/photos permissions in `app.json`).

**Verify:** File visible in bucket + row in `media_assets`.

---

## Step 4 — RevenueCat (subscriptions)

1. **[REVENUECAT.md](./REVENUECAT.md)** + **[MONETIZATION.md](./MONETIZATION.md)**.
2. [app.revenuecat.com](https://app.revenuecat.com) → **Apps** → add **iOS** (bundle id) and **Android** (package).
3. **Entitlements** → create **`premium`** (required by `src/subscriptions/revenueCat.ts`).
4. **Offerings** → attach store products to **Current** offering.
5. Copy **public SDK keys** → `.env` (`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `_ANDROID`) and **EAS** env.
6. Test purchase in **sandbox** on a **dev/preview build** (not Expo Go).
7. **Optional production:** RevenueCat **Webhook** → your HTTPS endpoint → upsert **`subscription_state`** (see playbook §6.4).

---

## Step 5 — Wallet passes (choose one path)

**Path A — Pass2U:** Follow the **Pass2U** section above + their [Pass API 2.0 docs](https://www.pass2u.net/documentation): model in dashboard, server `POST` create pass, store `passId`, app opens download/add flow.

**Path B — Self-hosted Apple:** [STORE_RELEASE.md](./STORE_RELEASE.md) (Pass Type ID, certs), signing service, `.pkpass` delivery — full control.

**Path C — Another vendor (e.g. PassBuddy-style):** Same pattern as Pass2U: **server-side** secret, create pass via vendor API, return URL/file to app.

**Always:** Server-side **QR / token verification** for check-in — [QR_CHECKIN.md](./QR_CHECKIN.md).

---

## Step 6 — Native modules (Rive, image picker)

1. **Rive** — requires **dev client / EAS build** ([NEXT_STEPS.md](./NEXT_STEPS.md)); native bundled `.riv` or hosted `.riv` per `docs/VOLTAGENT_AWESOME_AGENT_SKILLS.md` / env `EXPO_PUBLIC_RIVE_*`.
2. **Image picker** — permissions already in config; validate on **physical device**.

---

## Step 7 — Monitoring & analytics (optional)

1. **[MONITORING_AND_ANALYTICS.md](./MONITORING_AND_ANALYTICS.md)** — e.g. Sentry DSN via EAS env, source maps for EAS builds.
2. **[INTEGRATIONS.md](./INTEGRATIONS.md)** — push, deep links if product needs them.

---

## Step 8 — Store release (when feature-complete)

1. **[STORE_RELEASE.md](./STORE_RELEASE.md)** end-to end: App Store Connect app record, privacy nutrition labels, screenshots, support URL, **App Store / Play** agreements, TestFlight / internal testing.

---

## Playbook sections not duplicated above (do when relevant)

| Section | When | Doc |
|--------|------|-----|
| **Google Play Console** | Before Android release or Play Billing | [REMAINING_TASKS_PLAYBOOK.md](./REMAINING_TASKS_PLAYBOOK.md) §5 |
| **Stripe (paid events)** | If you charge outside IAP rules | Playbook §10 |
| **Tighten RLS** | Before public beta | Playbook §14, [ACCESS_MODEL.md](./ACCESS_MODEL.md) |
| **Push & deep links** | If you need retention / OAuth recovery | Playbook §12, [INTEGRATIONS.md](./INTEGRATIONS.md) |

---

**Suggested order:** finish **1c OAuth** → **2 metadata** → **3 Storage** → **4 RevenueCat** → **5 Wallet (Pass2U or other)** + **8 QR server verify** → **8 store** when ready.
