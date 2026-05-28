# Customer-facing documentation (The Dalton Grant Academy / The Dalton Grant Academy)

Documents users should be able to reach from **iOS**, **Android**, and **web** (`EXPO_PUBLIC_DALTON_WEB_URL`).

## Required for App Store / Play / GDPR-style transparency

| Document | URL path | In-app entry | Status |
|----------|----------|--------------|--------|
| Terms of Service | `/terms` | Settings → Legal | `terms.html` (replace `[Company]` placeholders) |
| Privacy Policy | `/privacy` | Settings → Legal | `privacy.html` (replace contact/date placeholders) |
| Cookie policy | `/cookie-policy` | Settings → Legal | `cookie-policy.html` (also `/cookies` redirect) |
| Athlete / program agreement | `/athlete-agreement` | Settings → Legal | `athlete-agreement.html` |
| Support / contact | `/contact-us` | Settings → Support | `contact-us.html` |
| Help / FAQ | `/help-center` | Settings → Support | `help-center.html` (expand before launch) |

## Strongly recommended

| Document | Suggested path | Notes |
|----------|----------------|-------|
| Subscription / billing FAQ | `/billing` or section in help-center | RevenueCat (native) vs Stripe (web) |
| Community guidelines | `/community-guidelines` | Moderation, reporting |
| Event host terms | `/host-terms` | If hosts publish paid events |
| Accessibility statement | `/accessibility` | Mirror App Store declaration (4 features) |
| Data deletion instructions | `/privacy#deletion` + in-app | Apple requires in-app deletion when offering account creation |

## In-app only (not a public URL required)

- Notification category toggles (Settings → Notifications)
- Privacy toggles synced via `user_settings.preferences.privacy`
- Accessibility toggles synced via `user_settings.preferences.accessibility`
- Messaging “allow messages from” (local + profile metadata)

## Cross-platform parity

- Set the **same** `EXPO_PUBLIC_DALTON_WEB_URL` in Expo `.env`, EAS secrets, and Vercel production.
- Legal links in the app open that base URL on native; on web they open in a new tab.
- Accessibility preferences sync to Supabase `user_settings` when signed in (see `AccessibilityProvider`).
- Community feed uses Supabase Realtime + pull-to-refresh + refetch when the app returns to foreground (web tab focus included).

## Vercel deploy

Root `vercel.json` rewrites map paths to static HTML. `npm run vercel-build` copies all `*.html` from the repo root into `web-deploy/`.

## Before launch checklist

1. Replace all `[bracket]` placeholders in legal HTML with legal entity name, address, and emails.
2. Have counsel review Terms, Privacy, Cookie, and Athlete Agreement.
3. Add App Store “Privacy Policy URL” and “Support URL” to match live paths.
4. Publish help-center articles (account, events, premium, safety).
5. Wire production support inbox and SLA for deletion requests (max 30 days typical).
