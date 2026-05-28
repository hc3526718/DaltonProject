# Ship to App Store Connect and TestFlight (no dev server)

TestFlight installs are **full native binaries** with JS bundled in — you do **not** run `expo start`.

Bundle ID for this app: **`com.hc111.daltondemo`** (`app.json` / `app.config.js`).

## Prerequisites

1. **Apple Developer Program** membership (paid).
2. **App Store Connect** — an app record whose bundle ID matches **`com.hc111.daltondemo`**.  
   - [App Store Connect](https://appstoreconnect.apple.com/) → **Apps** → **+** → New App → choose iOS, name, SKU, bundle ID (create the bundle ID in [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) if needed).
3. **EAS** logged in: `eas login` (same Expo account as `owner` in `app.json` / `app.config.js`, e.g. `hc111`).
4. **Environment variables on EAS** for anything the app needs at runtime (`EXPO_PUBLIC_SUPABASE_*`, RevenueCat keys, etc.). Local `.env` is **not** sent to EAS unless you configure [EAS Environment variables](https://docs.expo.dev/build-reference/variables/). Set them in the Expo dashboard → your project → **Environment variables** (or `eas secret:create`) for the **production** environment used by the production build profile.

## One-time: iOS credentials

From **`expo-app/`**:

```bash
cd expo-app
eas credentials
```

Follow prompts so EAS can create or reuse **Distribution certificate** and **App Store provisioning profile** for `com.hc111.daltondemo`.

## Build for the App Store (store-signed `.ipa`)

```bash
cd expo-app
eas build --profile production --platform ios
```

The **`production`** profile in `eas.json` uses **`distribution": "store"`** so the artifact is meant for **App Store Connect / TestFlight** (not the Expo “internal install” link).

Wait for the build to finish on [expo.dev](https://expo.dev) → your project → **Builds**.

## Submit to App Store Connect

**Option A — submit the latest finished iOS production build (simplest):**

```bash
cd expo-app
eas submit --platform ios --latest
```

**Option B — interactive** (EAS asks questions / uses ASC API key you configure):

```bash
eas submit --platform ios
```

First-time submit often needs:

- **App Store Connect API key** (recommended): [Expo: Submit with ASC API key](https://docs.expo.dev/submit/ios/#app-store-connect-api-key), or  
- **Apple ID** + app-specific password (less ideal).

Optional: add **`submit.production.ios.ascAppId`** in `eas.json` (numeric App ID from App Store Connect → your app → **App Information**) so non-interactive submit always targets the right app.

## TestFlight on your iPhone

1. **App Store Connect** → your app → **TestFlight** tab.
2. Wait for processing (often 5–30 minutes after a successful submit; first build can take longer).
3. Answer **export compliance** if prompted (this project sets `ITSAppUsesNonExemptEncryption` / `usesNonExemptEncryption` to **false** in config — you still confirm in ASC if asked).
4. **Internal testing**: add your Apple ID under **Users and Access** → enable as **Internal** tester, or use the **Internal Testing** group in TestFlight.
5. On the **iPhone**, install the **TestFlight** app from the App Store, accept the invite, install **Dalton Demo**.

### “No Builds Available” in App Store Connect (your screenshot)

That status means **TestFlight has no build this tester can install yet** — usually because:

1. **No production build was submitted** to this app (`eas submit --platform ios --latest`), or  
2. A build was submitted but is still **Processing** (wait and refresh), or  
3. The build is **blocked** until you complete **Export compliance** (or other metadata) in App Store Connect → **TestFlight** → select the build → answer the questions.

Until at least one build shows as **Ready to Submit** / **Ready to Test** for **Internal Testing** and is assigned to the **Internal** group, testers will show **No Builds Available** and the TestFlight app may look empty or ask for a **redeem code** (there is nothing to redeem yet).

**What to do:** run **`eas build --profile production --platform ios`**, then **`eas submit --platform ios --latest`**, then in App Store Connect open **TestFlight** → your iOS build → finish compliance → add the build to **Internal testing** if needed. After processing, open **TestFlight** on the phone — your app should appear **without** typing an invitation code (internal testers use their Apple ID).

**Invitation / redeem code:** used mainly for **External testing** public links or special invites. **Internal** testers (`… · Internal`) normally do **not** need a code; they need a **processed build** first.

## RevenueCat on TestFlight builds

Use the **App Store / production** RevenueCat **public SDK key** for iOS in EAS env (`EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`), not only the Test Store key. Rebuild after changing env vars.

## Android (optional)

Production profile builds an **`.aab`** for Play Console:

```bash
eas build --profile production --platform android
eas submit --platform android --latest
```

## Troubleshooting

- **“No Builds Available”** for internal testers: no submitted + processed build yet, or compliance not done — see section above.
- **TestFlight asks for an invitation code** with no build: same root cause — submit a **store** production build first; internal testing does not require a redeem code once a build is live for your group.
- **“No install button, only download”** on expo.dev: that applies to **internal** `.ipa` builds. **Store** production builds are installed via **TestFlight**, not the Expo OTA install page.
- **Missing compliance / missing export** in ASC: complete the questionnaire in App Store Connect for the build to move to **Ready to Test**.

Official references: [EAS Submit iOS](https://docs.expo.dev/submit/ios/), [TestFlight](https://developer.apple.com/testflight/), [EAS Build](https://docs.expo.dev/build/introduction/).
