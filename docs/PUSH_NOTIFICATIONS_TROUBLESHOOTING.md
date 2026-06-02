# Push notifications — troubleshooting

Configuring **APNs in Expo/EAS** does **not** show the iOS permission dialog. The system popup only runs when the app calls `requestPermissionsAsync()` — which happens **after you sign in** (not on the auth/welcome screen).

## Checklist (no popup on development build)

### 1. Sign in on a real device

- Use a **physical iPhone** (push is unreliable on the **Simulator**).
- Complete **email/password or OAuth sign-in** so a Supabase session exists.
- **Demo / guest accounts** (`demo-*`) never register push.

### 2. Rebuild the dev client (required once)

The `expo-notifications` plugin is **native**. If your development build was created **before** that plugin was added, permission calls fail silently.

```powershell
cd C:\Users\haydn\Downloads\DaltonProject\expo-app
eas build --platform ios --profile development
```

Install the new `.ipa` from the EAS build page, then run Metro:

```powershell
npx expo start --dev-client
```

### 3. You may have already answered “Don’t Allow”

iOS shows the alert **once per install**. If you denied it:

- **Settings → Notifications → The Dalton Grant Academy** → enable **Allow Notifications**, or  
- Delete the app → reinstall the dev build → sign in again.

### 4. Re-trigger from in-app settings

**Profile → Settings → Notifications** → turn **Push** off, then on again. That calls `tryRegisterPushToken` again.

### 5. Watch Metro logs (development)

With the dev client connected to Metro, sign in and look for lines starting with `[push]`:

| Log | Meaning |
|-----|--------|
| `skip: no user or demo account` | Not signed in |
| `skip: Supabase not configured` | Missing `EXPO_PUBLIC_SUPABASE_*` in `.env` |
| `skip: push disabled in user prefs` | Push off in notification settings |
| `permission (before request) denied` | Already denied — use iOS Settings |
| `registration failed` | Old dev build without native module — rebuild |
| `Expo push token server timed out` | Device could not reach `exp.host` (see below) |
| `retrying Expo push token` | Automatic retry after Expo 503/timeout |
| `token saved to Supabase` | Success |

### Expo `exp.host` timeout / upstream error

If Metro shows:

`[expo-notifications] Error encountered while updating the device push token with the server: upstream connect error … connection timeout`

that is **Expo’s push token API** (`getExpoPushTokenAsync`), not Supabase. Common causes:

1. **Transient Expo outage or slow response** — wait and sign in again, or **Settings → Notifications → Enable notifications** (retries with backoff).
2. **Network** — use stable Wi‑Fi; turn off VPN / corporate proxy blocking `exp.host`.
3. **Concurrent calls** — the app dedupes registration; avoid spamming toggle on/off rapidly.
4. **iOS development build** — ensure **EAS → Credentials → Push Notifications** (APNs `.p8` key) is set for project `dalton-demo`.

Check [status.expo.dev](https://status.expo.dev). You can test connectivity on the device browser: `https://exp.host` should load.

### 6. Confirm token in Supabase

Supabase → **Table Editor** → `device_push_tokens` → row for your `user_id` with `expo_push_token` like `ExponentPushToken[...]`.

### 7. Expo / Apple credentials (for **delivery**, not the popup)

- [expo.dev](https://expo.dev) → project **dalton-demo** → **Credentials** → iOS **Push Notifications** (`.p8` APNs key recommended).
- Apple Developer → App ID `com.hc111.daltondemo` → **Push Notifications** enabled.

Without APNs on EAS, you can still get the permission popup and a token, but **sending** a test push from [expo.dev/notifications](https://expo.dev/notifications) may fail.

### 8. Send a test push

1. Copy `ExponentPushToken[...]` from logs or `device_push_tokens`.
2. [expo.dev/notifications](https://expo.dev/notifications) → paste token → send test.
3. App **backgrounded** or **locked** to see the system banner (foreground uses in-app alerts).

## What Expo dashboard setup does vs app code

| Step | Shows iOS popup? |
|------|------------------|
| APNs key uploaded in EAS | No |
| `expo-notifications` in `app.config.js` | No (needs native rebuild) |
| User signs in → `tryRegisterPushToken` | **Yes** (if not already granted/denied) |

See also `docs/APPLE_PUSH_SSL_SETUP.md` and `docs/REMAINING_IMPLEMENTATION.md`.
