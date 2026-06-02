# TestFlight — production iOS build

The **home screen name** under the icon comes from the **native build**, not from JavaScript. An older TestFlight build may still show **DaltonDemo** if it was built before `app.config.js` set `name` and `CFBundleDisplayName` to **The Dalton Grant Academy**.

## Push a new build to TestFlight

From `expo-app` (after `eas login`):

```powershell
cd C:\Users\haydn\Downloads\DaltonProject\expo-app

# Store / TestFlight (no Metro dev server required)
eas build --platform ios --profile production

# When the build finishes:
eas submit --platform ios --latest
```

Or build + submit in one flow (interactive):

```powershell
eas build --platform ios --profile production --auto-submit
```

## Profiles

| Profile | Use |
|---------|-----|
| `development` | Dev client; can attach to Metro |
| `preview` | Internal testing (Ad Hoc / internal distribution) |
| **`production`** | **App Store Connect → TestFlight → App Store** |

## Before you submit

1. **EAS env** — Production environment on [expo.dev](https://expo.dev) should include `EXPO_PUBLIC_SUPABASE_*`, `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_DALTON_WEB_URL`, etc.
2. **App Store Connect** — App record uses bundle ID `com.hc111.daltondemo` (must match `app.config.js`).
3. **Version** — Bump `version` in `app.config.js` for each TestFlight upload (now `1.0.1+`). Production profile uses `autoIncrement` for build number.
4. **Free plan** — If EAS reports monthly iOS build limit, wait for reset or upgrade billing.

## After submit

1. App Store Connect → **TestFlight** → wait for processing (~10–30 min).
2. Add internal/external testers.
3. Install on device; confirm icon label **The Dalton Grant Academy**.

See also `docs/STORE_RELEASE.md`.
