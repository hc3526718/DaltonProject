# RevenueCat & premium entitlements

**Related:** `docs/NEXT_STEPS.md` §4, `docs/MONETIZATION.md`, `docs/ACCESS_MODEL.md` §7, `docs/SECRETS_CHECKLIST.md`.

## Entitlement

- App checks entitlement id **`premium`** (see `src/subscriptions/revenueCat.ts`).
- Free tier: browse events, limited saves (enforce in API later).
- Premium: unlimited saves, early booking, offline media, ad-free — gate in UI + server.

## App setup

1. Create a RevenueCat project; add iOS and Android apps matching your bundle IDs.
2. Create **Entitlement** `premium` and attach **Offering** / products from App Store Connect / Play Console.
3. Set in `.env`:
   - `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
   - `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
4. **Expo Go**: SDK is skipped (`executionEnvironment === 'expoGo'`). Use an **EAS development** or **preview** build to test purchases.

## Backend webhook (server truth)

1. In RevenueCat dashboard → **Integrations** → **Webhooks** → your API URL, e.g. `POST https://api.yourapp.com/webhooks/revenuecat`.
2. Verify webhook signature per RevenueCat docs.
3. Upsert `subscription_state` (see `backend/schema.sql`): `user_id`, `is_pro`, `entitlement_ids`, `raw`.
4. API routes that require premium must read **database**, not only the client.

## Paywall UI

- **Settings → Premium** opens `PaywallScreen` (refresh / restore).
- The app calls **`presentPaywall({ offering })`** with an offering from **`fetchOfferingForPaywall()`**: it prefers **`EXPO_PUBLIC_REVENUECAT_OFFERING_IDENTIFIER`** (RevenueCat **lookup key**), then **`Official Offering`**, then **`default`**, then the dashboard **current** offering. That avoids showing **Test Store** prices when your dashboard **current** offering still points at Test Store products while App Store products live on another offering (see MCP / dashboard alignment).
- **Layout / small phones (e.g. iPhone 11 Pro):** Paywalls **v2** are configured in the RevenueCat builder (margins, image scale, typography). The SDK’s `fontFamily` / `displayCloseButton` options apply to **original template** paywalls only and are **ignored for v2**. After **Paywall AI** or manual edits, **publish** the paywall in the dashboard so devices fetch the updated template (no app rebuild required for template-only changes). Set **`EXPO_PUBLIC_REVENUECAT_PROJECT_ID`** (same value as the API project id, e.g. `proj…`) in `.env` so Cursor’s RevenueCat MCP targets the correct project.

## SDK version policy (RevenueCat minimums)

This Expo app only ships **`react-native-purchases`** + **`react-native-purchases-ui`**. Keep them on the latest **10.x** release compatible with your Expo SDK; **`package.json` currently uses `^10.1.0`**, which is above RevenueCat’s **`react-native-purchases` ≥ 8.11.3** recommendation. Native **Purchases iOS / Android** versions come from **PurchasesHybridCommon** pinned by that package’s podspec / Gradle (not edited manually).

| SDK | RevenueCat minimum | This repo |
|-----|-------------------|-----------|
| purchases-ios | 5.27.1+ | Via **react-native-purchases** → Hybrid Common (satisfied in supported releases) |
| purchases-android | 8.19.2+ | Via **react-native-purchases** → Hybrid Common (satisfied in supported releases) |
| **react-native-purchases** | **8.11.3+** | **`^10.1.0`** |
| purchases-flutter | 8.10.1+ | N/A — not a Flutter app |
| purchases-kmp | 1.8.2+13.35.0+ | N/A — not Kotlin Multiplatform |
| purchases-capacitor | 10.3.3+ | N/A — not Capacitor |
| **purchases-js** | **1.18.0+** | Transitive **`@revenuecat/purchases-js`**; **`package.json` `overrides`** enforce **`>=1.18.0`** |
| purchases-unity | 8.4.0+ | N/A — not Unity |

After changing RevenueCat-related versions, run **`npm install`** in **`expo-app/`** and rebuild native (**EAS** / prebuild).
