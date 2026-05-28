# Billing sandbox testing (Stripe + RevenueCat + Supabase)

Use this when validating webhooks and purchase flows end-to-end.

**Project ref:** `txehbzyntvqpkkegjrwp`

---

## MCP audit summary (The Dalton Grant Academy)

| System | Status | Action |
|--------|--------|--------|
| **Stripe** | Test prices exist (`price_1TXSE…` monthly £11.99, annual £99.99) | Use **test** keys (`sk_test_`, `whsec_`) in Supabase secrets |
| **RevenueCat** | Webhook `DAWebHook` → Supabase URL; entitlements `premium` + Grant Access Pro | **Production-only** webhook today — see §1 for sandbox |
| **Supabase** | Edge functions deployed; RC webhook returning **200** in logs | Stripe webhook needs real `Stripe-Signature` |

---

## 1. RevenueCat — sandbox webhooks

Your existing webhook (`whintgr7b77962367`, **DAWebHook**) is **production-only** (`environment: production`, scoped to App Store app `appc5b5f36102`). Sandbox App Store / TestFlight purchases will **not** update Supabase until sandbox events are delivered.

**RevenueCat limit:** You cannot register a second webhook with the **same URL** on the same project (API returns `409 resource_already_exists`). A separate **DAWebHook-Sandbox** name is only possible with a **different** endpoint URL, or you change the existing integration.

**Practical sandbox options:**

1. **Temporarily** edit **DAWebHook** in RevenueCat → set **Environment** to include sandbox / all environments (if the dashboard offers it), or set `environment` to `null` via MCP `update-webhook-integration` while testing, then restore `production` before App Store release.
2. Keep production webhook as-is and test **web billing** via Stripe (below) — does not need the RC sandbox webhook for `subscription_state` if `stripe-webhook` is configured.

### Option A — RevenueCat MCP (Cursor) — confirmed working

Ensure **revenuecat** is enabled in `.vscode/mcp.json` (or global `~/.cursor/mcp.json`), then **reload MCP** / re-authenticate if tools are missing. In chat:

```
list-webhook-integrations { "project_id": "proj88ab5ee7" }
create-webhook-integration {
  "project_id": "proj88ab5ee7",
  "name": "DAWebHook-Sandbox",
  "url": "https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/revenuecat-webhook",
  "authorization_header": "Bearer <same token as Supabase REVENUECAT_WEBHOOK_AUTHORIZATION>",
  "environment": "sandbox"
}
```

`mcporter` CLI currently fails against RevenueCat (SSE 405); use Cursor’s built-in MCP or the script below.

### Option B — Terminal script (API v2 secret)

```powershell
cd C:\Users\haydn\Downloads\DaltonProject
$env:REVENUECAT_API_V2_SECRET_KEY = "sk_..."   # RevenueCat → Project → API keys → Secret (v2)
$env:REVENUECAT_WEBHOOK_AUTH = "Bearer <REVENUECAT_WEBHOOK_AUTHORIZATION>"
node scripts/revenuecat-sandbox-webhook.mjs
```

Do **not** change the production **DAWebHook** to sandbox-only while App Store production purchases are live.

**Test purchase path:**

1. Sign in on device with Supabase user id = RevenueCat `app_user_id` (UUID).
2. Sandbox subscription in App Store Connect.
3. Confirm `subscription_state.is_pro` and `updated_at` change in Supabase.

**PowerShell test (auth):**

```powershell
$secret = "YOUR_TOKEN"
$body = '{"event":{"type":"INITIAL_PURCHASE","app_user_id":"YOUR_USER_UUID","entitlement_ids":["premium"]}}'
Invoke-RestMethod -Method POST -Uri "https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/revenuecat-webhook" -Headers @{ Authorization = "Bearer $secret"; "Content-Type" = "application/json" } -Body $body
```

---

## 2. Stripe — test mode (MCP + Dashboard)

Stripe MCP shows account **The Dalton Grant Academy** with test recurring prices. Map them in Supabase:

```powershell
npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... --project-ref txehbzyntvqpkkegjrwp
npx supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_... --project-ref txehbzyntvqpkkegjrwp
npx supabase secrets set STRIPE_PRICE_MONTHLY_ID=price_1TXP2BRiVFlZ45SI385a4Hs1 --project-ref txehbzyntvqpkkegjrwp
npx supabase secrets set STRIPE_PRICE_ANNUAL_ID=price_1TXP46RiVFlZ45SIKs5TENQk --project-ref txehbzyntvqpkkegjrwp
```

**Verify digests** (does not print secret values):

```powershell
$env:STRIPE_SECRET_KEY = "sk_test_..."
$env:STRIPE_WEBHOOK_SECRET = "whsec_..."
node scripts/verify-stripe-supabase-secrets.mjs
```

**Test-mode price IDs** (Stripe Dashboard with **Test mode ON**): monthly `price_1TXP2BRiVFlZ45SI385a4Hs1`, annual `price_1TXP46RiVFlZ45SIKs5TENQk`.  
**Live-mode price IDs** (different IDs): `price_1TXSERRiVFlZ45SIaDXL6xpx` / `price_1TXSEORiVFlZ45SINHhHucgV`.  
Checkout fails with HTTP 500 if `STRIPE_SECRET_KEY` is `sk_test_` but secrets still point at **live** price IDs (or the reverse).

**Dashboard:** Developers → Webhooks → endpoint  
`https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/stripe-webhook`  
Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

### Two different Stripe destinations (do not mix secrets)

| Destination | URL | Signing secret goes to |
|-------------|-----|------------------------|
| **Your Supabase app** | `…/functions/v1/stripe-webhook` | Supabase secret `STRIPE_WEBHOOK_SECRET` |
| **RevenueCat** (connected platform) | RevenueCat’s URL on `stripe.revenuecat.com` etc. | RevenueCat dashboard only — **not** Supabase |

Stripe can show **“delivery to connected platform successful”** for RevenueCat while your Supabase endpoint still returns **`invalid_signature`** if `STRIPE_WEBHOOK_SECRET` is wrong or copied from the wrong place.

**If verify script shows `STRIPE_WEBHOOK_SECRET: MATCH` but Stripe resend still returns `invalid_signature`:** you almost certainly have **two webhook endpoints** (or test vs live) with **different** `whsec_` values. Open the **failed delivery** in Stripe and note the **Endpoint** (`we_…`). Reveal the secret on **that** endpoint only — not another endpoint that happens to use the same URL. Prefer **Send test event** on that endpoint over resending a very old delivery.

**Fix `invalid_signature`:** Stripe → **Test mode ON** → **Developers → Webhooks** → open the endpoint whose URL is exactly `https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/stripe-webhook` → **Signing secret** → Reveal → copy `whsec_…` →:

```powershell
npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_PASTE_FROM_THAT_ENDPOINT_ONLY" --project-ref txehbzyntvqpkkegjrwp
```

Then on that same endpoint → **Event deliveries** → failed event → **Resend**. Success = **200** and `subscription_state.updated_at` becomes “just now”.

**Do not use** the signing secret from `stripe listen` unless you are only testing via CLI forwarding.

### Where to see test payment analytics

| Where | What you see |
|-------|----------------|
| **Stripe** (Test mode ON) | **Payments**, **Customers**, **Subscriptions**, **Developers → Webhooks → Event deliveries** |
| **RevenueCat** | App Store / Play / RC Web Billing purchases — **not** every direct Supabase Checkout unless RC Stripe sync is configured |
| **Supabase** | Table `subscription_state` (`is_pro`, `updated_at`, `raw`) after **your** webhook returns 200 |

**Do not** use Supabase “Invoke function” for `stripe-webhook` — that always returns `missing_signature` (expected).

If Stripe shows `SubtleCryptoProvider cannot be used in a synchronous context`, the Edge function must use `constructEventAsync` (not `constructEvent`) — redeploy `stripe-webhook`.

**CLI test:**

```powershell
stripe listen --forward-to https://txehbzyntvqpkkegjrwp.supabase.co/functions/v1/stripe-webhook
```

Set `STRIPE_WEBHOOK_SECRET` to the **CLI** `whsec_…` while listening.

**Checkout test:** Sign in on web → Premium → checkout.  
`stripe-create-checkout` needs the **user JWT** from the signed-in session (not anon key). Supabase invoke with `{ "name": "Functions" }` returns `invalid_token` (expected).

---

## 3. Supabase verification (MCP)

```
execute_sql: SELECT user_id, is_pro, entitlement_ids, updated_at FROM subscription_state ORDER BY updated_at DESC LIMIT 5;
get_logs: { "service": "edge-function" }
```

Expect: `revenuecat-webhook` 200, `stripe-webhook` 200 after Stripe CLI/Dashboard test.

---

## 4. Environment split (recommended)

| Env | Stripe | RevenueCat webhook | EAS keys |
|-----|--------|-------------------|----------|
| **Preview / dev** | `sk_test_`, test `whsec_` | Sandbox + Production webhooks | `appl_` / `goog_` sandbox |
| **Production** | `sk_live_`, live `whsec_` | Production webhook only | Live store keys |

Never put `STRIPE_SECRET_KEY` or webhook secrets in Vercel or EAS — **Supabase Edge secrets only**.

---

## 5. Manual test checklist (no production EAS build required)

### Web (Stripe + Supabase) — test this first

1. **Supabase secrets:** `sk_test_…`, `whsec_…`, price IDs (see §2). Run `node scripts/verify-stripe-supabase-secrets.mjs` with your test keys.
2. **Vercel / local env:** `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` (not only `pk_live_` in a non-public var).
3. Open `https://daltongrantacademy.vercel.app/app` (or `npx expo start --web`), **sign in** with the account you want to upgrade.
4. **Settings → Premium** (or Paywall) → choose Monthly/Annual → complete Stripe Checkout with card `4242 4242 4242 4242`.
5. After redirect (`?stripe_checkout=success`), confirm premium gates unlock and run in Supabase SQL:
   `SELECT user_id, is_pro, entitlement_ids, updated_at FROM subscription_state WHERE user_id = '<your-uuid>';`
6. Optional: Stripe Dashboard → Webhooks → send test `checkout.session.completed` to `…/stripe-webhook` (not Supabase “Invoke”).

### Mobile (RevenueCat / App Store) — without a new production build

| Path | What you need | Purchases? |
|------|----------------|------------|
| **Expo Go** | `npx expo start` | **No** native RevenueCat paywall (`Purchases` not configured in Expo Go). |
| **Web on phone** | Same as web checklist in mobile browser | **Yes** (Stripe path). |
| **Existing dev/preview build** on device | Already installed `.ipa`/`.apk` from last EAS **development** or **preview** profile | **Yes** if build includes `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` / `_ANDROID` and is not Expo Go. |
| **New native build** | EAS when credits return | Required for fresh native RC paywall changes. |

**When you have any native dev client (not Expo Go):**

1. Sign in so RevenueCat `app_user_id` = Supabase user UUID (`Purchases.logIn`).
2. **Settings → Premium** → RevenueCat paywall; use **Sandbox Apple ID** (Settings → App Store → Sandbox Account).
3. After purchase, confirm `subscription_state` updates. If not, fix **DAWebHook** environment (§1) — production-only webhooks skip sandbox store events.
4. **Restore purchases** on a second device with the same Apple ID / account.

**Offering:** MCP shows **Official Offering** is current (`ofrng147d5e4cfe`) — ensure `EXPO_PUBLIC_REVENUECAT_OFFERING_IDENTIFIER=Official Offering` in env for paywall alignment.
