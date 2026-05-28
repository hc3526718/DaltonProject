# Apple & Google sign-in / sign-up (Supabase + Expo) — full checklist

This guide expands **Step 1e** in [WHAT_NEXT.md](./WHAT_NEXT.md). Paths are relative to **`expo-app/`**.

---

## A. Understand what runs where

| Capability | Expo Go | Development build (`expo run:*` / EAS dev client) |
|------------|---------|-----------------------------------------------------|
| Email/password (Supabase) | Yes | Yes |
| **Google** OAuth (`expo-web-browser`) | Usually yes | Yes |
| **Sign in with Apple** (`expo-apple-authentication`) | **No** — native module not in Expo Go | Yes (after rebuild) |
| **Rive** animations | **No** — app falls back to logo/spinner | Yes |

If you see **`Invariant Violation: ... native module that doesn't exist`**, you are almost always on **Expo Go** with a module that requires a **custom dev client**. Build one: [Development builds introduction](https://docs.expo.dev/develop/development-builds/introduction/).

The Dalton app avoids **static** imports of `expo-apple-authentication` and `rive-react-native` on code paths that load in Expo Go, so the JS bundle should start cleanly; Apple and Rive still need a dev build to function.

---

## B. App configuration (already in repo)

1. **`app.json`** includes:
   - `"scheme": "dalton-demo"` — used for OAuth return URLs.
   - Plugins **`expo-web-browser`** and **`expo-apple-authentication`** (Apple needs a **native rebuild** after any plugin change).

2. **`index.ts`** calls `WebBrowser.maybeCompleteAuthSession()` so the browser session can hand off to the app after OAuth.

3. Redirect path used in code: `Linking.createURL('auth/callback')` → typically  
   `dalton-demo://auth/callback`  
   in a build that uses the `dalton-demo` scheme.

4. **Google iOS client plist** — `config/google_ios_client.plist` matches bundle id `com.hc111.daltondemo`. **`app.config.js`** merges **`CFBundleURLTypes`** with the plist’s **`REVERSED_CLIENT_ID`** so native Google URL callbacks resolve if you add native Google Sign-In later. Current **Supabase Google** flow still uses the **Web client** in the Supabase dashboard + `signInWithOAuth`.

---

## C. Why `npx uri-scheme list` says “Could not find any native URI schemes”

That CLI reads **native** project files (e.g. after `expo prebuild` or from an EAS-generated `ios`/`android` folder). If you only use **Expo Go** and have **no** checked-in `ios`/`android` directories, there may be nothing for it to list.

**You do not need that command to configure Supabase.** Use the URLs below.

---

## D. Redirect URLs to add in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration** → **Redirect URLs**.

2. **Always add** (development client / production with scheme `dalton-demo`):

   `dalton-demo://auth/callback`

3. **Expo Go / Metro** — the exact string depends on your machine. After `npx expo start`, open the dev menu or check the terminal: the app’s origin often looks like `exp://192.168.x.x:8081` or `exp://127.0.0.1:8081`. Expo’s `Linking.createURL('auth/callback')` appends the path. Add **each** URL you see when testing (including LAN IP variants if you switch networks).

   Examples (your values will differ):

   - `exp://127.0.0.1:8081/--/auth/callback`
   - `exp://192.168.1.10:8081/--/auth/callback`

4. Optional: log it once from a dev build:

   ```ts
   import * as Linking from 'expo-linking';
   console.log(Linking.createURL('auth/callback'));
   ```

5. **Site URL** in the same Supabase screen can stay your web URL or `https://localhost` for mobile-only; what matters for mobile OAuth is the **Redirect URLs** allowlist.

---

## E. Google — Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → select or create a project.

2. **APIs & Services** → **OAuth consent screen**  
   - Choose **External** (or Internal for Workspace-only).  
   - Fill app name, support email, developer contact.  
   - While in **Testing**, add **Test users** (the Gmail accounts that may sign in).

3. **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**.

4. Create a **Web application** client (Supabase uses this for the server-side exchange):

   - **Authorized redirect URIs**: add the redirect URI Supabase shows for Google (in Supabase → **Authentication** → **Providers** → **Google** — usually like  
     `https://<project-ref>.supabase.co/auth/v1/callback`).

5. Copy **Client ID** and **Client Secret**.

6. In **Supabase** → **Authentication** → **Providers** → **Google**:

   - Enable the provider.  
   - Paste **Client ID** and **Client Secret**.  
   - Save.

7. **Optional native clients** (recommended for production polish):

   - **iOS** OAuth client: bundle ID from `app.json` / Xcode (e.g. `com.yourcompany.daltondemo`).  
   - **Android** OAuth client: package name + SHA-1 from your keystore (see [Google’s Expo/Android docs](https://docs.expo.dev/guides/google-authentication/)).

---

## F. Google — verify in the app

1. `.env` has `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

2. Supabase **Redirect URLs** include your `dalton-demo://` and any `exp://.../--/auth/callback` URLs you use.

3. Run the app, tap **Continue with Google**, complete the browser flow, confirm you return to the app signed in.

---

## G. Apple — Apple Developer

1. [Apple Developer](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles**.

2. **Identifiers** → **App IDs** → your app’s identifier (must match **iOS bundle identifier** in `app.json` / EAS).

   - Enable capability **Sign In with Apple**.

3. **Identifiers** → **Services IDs** (for web / Supabase “web” flow if required):

   - Create a Services ID (e.g. `com.yourcompany.daltondemo.web`).  
   - Enable **Sign In with Apple**.  
   - Configure **Domains and Subdomains** and **Return URLs** as [Supabase Apple docs](https://supabase.com/docs/guides/auth/social-login/auth-apple) specify (often your `https://<project-ref>.supabase.co/auth/v1/callback` or the exact URL shown in the dashboard).

4. **Keys** → create a key with **Sign In with Apple** enabled.  
   - Download the **.p8** file once.  
   - Note **Key ID** and **Team ID**.

5. In **Supabase** → **Authentication** → **Providers** → **Apple**:

   - Enable Apple.  
   - Enter **Services ID** (if using Services ID flow), **Secret Key** (.p8 contents), **Key ID**, **Team ID**, and **Bundle ID** as the form requests.  
   - Follow [Supabase: Login with Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) for the exact field mapping.

---

## H. Apple — native app (Expo)

1. `expo-apple-authentication` is in `app.json` **plugins**.

2. Run a **native** build (not Expo Go):

   ```bash
   npx expo run:ios
   ```

   or EAS:

   ```bash
   eas build --profile development --platform ios
   ```

3. On device/simulator, tap **Continue with Apple** and complete the sheet.

---

## I. Troubleshooting

| Symptom | What to check |
|---------|----------------|
| `redirect_uri_mismatch` (Google) | Redirect URLs in **Google Cloud** web client must include Supabase’s `.../auth/v1/callback`. App deep link must be in **Supabase** Redirect URLs. |
| OAuth returns to app but not signed in | Parsing `code` failed; confirm Supabase **PKCE** flow and `exchangeCodeForSession` (already used in `oauthSupabase.ts`). |
| Apple works on device but not in simulator | Use a signed-in iCloud account; some simulator setups are limited. |
| “Native module does not exist” | Use a **development build**, not Expo Go, for Apple and Rive. |

---

## J. Related files in this repo

- `src/auth/oauthSupabase.ts` — Google OAuth + Apple `signInWithIdToken`.
- `src/auth/AuthContext.tsx` — `signInWithGoogle` / `signInWithApple`.
- `src/screens/onboardingScreens.tsx`, `GrantAccessScreen.tsx` — OAuth buttons.

---

**End:** After both providers work, complete [BACKEND_AUTH.md](./BACKEND_AUTH.md) metadata (e.g. `dalton_verified`) for creator test accounts.
