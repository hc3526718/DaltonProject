# Backend & authentication

**Related:** `docs/NEXT_STEPS.md` (§0–§1, §3), `docs/PRE_LIVE_DATA_SETUP.md` (Google + manual gates before live data), `docs/SECRETS_CHECKLIST.md`, `backend/schema.sql`, `backend/handle_new_user.sql`, `backend/auth_default_dalton_verified.sql`, `backend/rls_policies.sql` (apply in that order after creating the project; run `auth_default_dalton_verified.sql` after `handle_new_user.sql`).

## Stack decision

**Primary stack: [Supabase](https://supabase.com)** — Postgres, Auth (email + OAuth), Storage buckets, Row Level Security (RLS), and optional Edge Functions. Fits posts, messages, events, and media metadata in one SQL model.

Alternatives (from product brief): Firebase (NoSQL + Auth + Storage), Clerk + hosted Postgres, Auth0/Cognito for enterprise SSO.

## Environment variables

See root `.env.example`. Required for live auth:

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS-enforced) |

When these are **empty**, the app keeps the **demo** email/password gate (`AuthContext`).

## Creator / host flags

### Default for every new account

- **App:** Email sign-up passes `dalton_verified: false` in `signUp` options; OAuth sessions run `ensureDefaultDaltonVerifiedMetadata` so missing keys are merged to **`false`**.
- **Database (recommended):** Run `backend/auth_default_dalton_verified.sql` so a **`BEFORE INSERT` on `auth.users`** always sets `raw_user_meta_data.dalton_verified` to **`false`** when absent. Run **`backend/handle_new_user.sql`** (updated) so **`public.profiles.dalton_verified`** matches metadata on insert.
- **Tamper protection:** The same SQL file adds a **`BEFORE UPDATE` on `public.profiles`** so a signed-in user **cannot** change their own `dalton_verified` column (staff use Table Editor / SQL / service role where `auth.uid()` is not the row owner).

### After Dalton approval (`profiles.dalton_verified`)

1. Staff sets **`public.profiles.dalton_verified = true`** for that user (dashboard/SQL / Master verification queue).
2. The app calls **`syncDaltonVerifiedFromProfileIfPremium`** (see `src/auth/userMetadataSupabase.ts`) so **`auth.users.raw_user_meta_data.dalton_verified`** mirrors **`true`** when metadata was still missing — **Settings** shows **Dalton verified**. (Premium is enforced separately for creator tools via `subscription_state` / paywall.)

For **manual testing** without going through the profile flow, you can set **`dalton_verified: true`** in **Authentication → Raw User Meta Data**. In production, **`canCreateVerifiedContent`** in `src/creator/creatorAccess.ts` still requires Premium + verification; **the server must re-check** before accepting uploads.

## Auth flows (app)

1. **Demo (default)** — `user123@gmail.com` / `12345!` sets local session only.
2. **Supabase** — `signInWithPassword` / `signUp`; session persisted via `expo-secure-store` adapter in `src/lib/supabase.ts`.
3. **Logout** — `signOut()` clears Supabase session and local demo state.

## Email confirmation & password reset (Supabase dashboard)

1. **Site URL** — set to your production marketing origin, e.g. `https://daltongrantacademy.vercel.app` (not `http://localhost:3000`). This is the fallback for auth emails if a flow does not override the redirect.
2. **Redirect URLs** — allow every URL the app opens after auth. Required entries include:
   - Web: `https://<your-domain>/app/auth/callback` (must match `EXPO_PUBLIC_OAUTH_REDIRECT_URL` or the default `window.location.origin + /app/auth/callback`).
   - Native dev build: your app scheme, e.g. `dalton-demo://auth/callback` (from Expo linking).
3. **Sign-up confirmation** — `AuthContext.signUp` passes `emailRedirectTo: getOAuthRedirectUri()` so the link in the confirmation email opens the real app (typically `/app/auth/callback`), not localhost.
4. **Forgot password** — `resetPasswordForEmail` uses the same `redirectTo`. After the user opens the link, the app establishes a recovery session and shows **Set new password** (`PasswordRecoveryScreen`).
5. **Optional** — set `EXPO_PUBLIC_OAUTH_REDIRECT_URL` to a fixed production callback if you need OAuth and email links to always target production during local dev.

## API layer

`src/api/client.ts` — `apiFetch(path, init)` attaches `Authorization: Bearer <access_token>` when Supabase session exists. Point `EXPO_PUBLIC_API_BASE_URL` at your API (e.g. Supabase Edge Functions or Railway).

## Secrets you must configure outside the repo

- Supabase **service role** key — server-only; never in the app.
- OAuth client secrets (Google/Apple) — Supabase dashboard.
- Stripe / RevenueCat — see `INTEGRATIONS.md` and `REVENUECAT.md`.
