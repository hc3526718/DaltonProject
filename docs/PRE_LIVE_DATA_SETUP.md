# Manual setup before live data & profile wiring

Do these **outside the repo** (dashboards, consoles, legal). After they are green, we can safely switch the app to live Supabase data, default avatars, and richer profile UX.

**Related:** [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md) (full detail), [BACKEND_AUTH.md](./BACKEND_AUTH.md), [DATABASE_SCHEMA_SOURCE.md](./DATABASE_SCHEMA_SOURCE.md), [REMAINING_TASKS_PLAYBOOK.md](./REMAINING_TASKS_PLAYBOOK.md), [STORE_RELEASE.md](./STORE_RELEASE.md).

---

## 1. Google Sign-In (Supabase + Google Cloud)

1. **[Google Cloud Console](https://console.cloud.google.com/)** — select project.  
2. **OAuth consent screen** — External (or Internal), app name, support email, **Test users** while in Testing.  
3. **Credentials** → **OAuth client ID** → type **Web application**.  
   - **Authorized redirect URIs:** add exactly what Supabase shows, usually  
     `https://<project-ref>.supabase.co/auth/v1/callback`  
4. Copy **Client ID** + **Client secret**.  
5. **[Supabase](https://supabase.com/dashboard)** → **Authentication** → **Providers** → **Google** — enable, paste ID/secret, save.  
6. **Authentication** → **URL Configuration** → **Redirect URLs** — ensure:  
   - `dalton-demo://auth/callback` (EAS / dev client)  
   - Any `exp://…/--/auth/callback` entries you still use with **Expo Go** (see [OAUTH_APPLE_GOOGLE.md](./OAUTH_APPLE_GOOGLE.md) §D).  
7. **Optional (recommended later):** iOS OAuth client in Google Cloud with bundle ID `com.hc111.daltondemo`; Android client + SHA-1 when you ship Play.  
8. **Verify:** dev build → **Continue with Google** → session in Supabase **Authentication → Users**.

---

## 2. Apple Sign-In (already working — keep aligned)

- **Apple Developer:** App ID matches bundle ID; **Sign in with Apple** on.  
- **Services ID** + **Return URL** = Supabase `https://…/auth/v1/callback` (not the `dalton-demo://` scheme).  
- **Supabase Redirect URLs** include `dalton-demo://auth/callback`.  
- Re-test after **any** bundle ID or scheme change.

---

## 3. Database: schema, trigger, RLS

Run in Supabase **SQL Editor** (order):

1. `backend/schema.sql`  
2. `backend/handle_new_user.sql` (creates `profiles` row on signup)  
3. `backend/rls_policies.sql`  
4. Optional: `backend/roadmap_extensions.sql` if you use those tables.

**Checks:** new signup → row in `public.profiles`; RLS allows expected reads/writes from the app (adjust policies before production — messages/posts are MVP-permissive).

---

## 4. EAS / env (so builds match local)

- **EAS Secrets / env:** mirror `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, RevenueCat keys, etc., for **preview/production** profiles.  
- After OAuth or scheme changes: **new iOS build** and reinstall.

---

## 5. Before “live data on all pages”

- [ ] **Storage buckets** + policies ([STORAGE.md](./STORAGE.md)) for real uploads.  
- [ ] **API / Edge Functions** if anything must not run with anon key only.  
- [ ] **Default avatar:** when `avatar_url` is null, use in-app asset **`DALTON_LOGO_FINAL_IMG`** (`assets/dalton_logo_final_img.png` — see `src/constants/brandAssets.ts`). Optionally set `profiles.avatar_url` on signup via trigger to a **public** Storage URL later.  
- [ ] **Metadata:** `dalton_verified`, roles — set in Supabase Auth user metadata or `profiles` for test accounts ([BACKEND_AUTH.md](./BACKEND_AUTH.md)).  
- [ ] **RevenueCat (iOS):** products + entitlements match code; [REVENUECAT.md](./REVENUECAT.md).  
- [ ] **Remove demo-only secrets** (e.g. ticket signing) for production — [SECRETS_CHECKLIST.md](./SECRETS_CHECKLIST.md).

---

## 6. Store / compliance (when you approach release)

- App Store Connect record, agreements, privacy labels, support URL.  
- [STORE_RELEASE.md](./STORE_RELEASE.md) + internal TestFlight pass on a **physical device**.

---

## 7. Splash / logo asset note

Native splash uses **`dalton_logo_final_img.png`** with **`#0A0A0A`** and **`contain`** (centered). If the PNG includes a **white** rectangular mat, you will see a light box on dark until you export a **transparent** background from your design tool.
