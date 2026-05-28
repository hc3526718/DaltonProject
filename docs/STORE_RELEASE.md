# Development builds & store release

**Related:** `docs/NEXT_STEPS.md` §6, `docs/REVENUECAT.md`, `docs/SECRETS_CHECKLIST.md`.

## EAS profiles (`eas.json`)

| Profile | Use |
|---------|-----|
| `development` | Dev client + native modules (RevenueCat, future scanner). iOS simulator + Android APK. |
| `preview` | Internal TestFlight / Play internal track. |
| `production` | App Store / Play production with auto-increment. |

## Commands (after `npm i -g eas-cli` and `eas login`)

```bash
cd expo-app
eas build --profile development --platform ios
eas build --profile preview --platform all
eas submit --platform ios --latest
```

## Pre-flight checklist

- [ ] `app.json`: `ios.bundleIdentifier`, `android.package`, version, icons, splash.
- [ ] Privacy manifests (iOS): photo/camera/mic usage strings when you add those features.
- [ ] App Store: screenshots, description, **privacy nutrition labels**, support URL, account deletion flow if you collect accounts.
- [ ] Google Play: Data safety form, content rating.
- [ ] RevenueCat + IAP products created and linked to the same bundle IDs.
- [ ] Supabase/production API URLs in EAS **secrets** or project env, not committed.

See also `SECRETS_CHECKLIST.md`.

## Pre-submit build checklist (app repo)

- [ ] `eas build --profile preview --platform all` succeeds after adding native modules (e.g. `rive-react-native` requires a **development/preview** build, not Expo Go).
- [ ] `ios.bundleIdentifier` / `android.package` are final in `app.json`.
- [ ] Apple Wallet: backend pass signing is live before marketing “Add to Wallet” in production.
- [ ] Run through auth → main tabs → booking QR → admin tools on a **physical device** build.

