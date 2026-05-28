# Remaining implementation — manual, external, and priority backlog

Last updated after community UX, messaging, storage, and activity-badge work.

**App Store encryption / DSA / trader:** copy-paste text in [`APP_ENCRYPTION_EXPORT_COMPLIANCE.md`](./APP_ENCRYPTION_EXPORT_COMPLIANCE.md).

**Go live (live keys, Sentry, manual dashboards):** [`GO_LIVE_CHECKLIST.md`](./GO_LIVE_CHECKLIST.md).

---

## Must apply on Supabase (if not already)

Run in SQL Editor (or via migrations `024`–`028`):


| Migration                                         | Purpose                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `024_profiles_athlete_and_catalog_storage.sql`    | Athlete details + catalog storage paths                                                                                                        |
| `025_bookings_event_user_unique.sql`              | Duplicate booking guard                                                                                                                        |
| `026_fix_dm_storage_and_proposal_limits.sql`      | DM notify, storage policies, proposal monthly cap                                                                                              |
| `027_storage_bucket_and_dm_rls_recursion.sql`     | `**media_assets` bucket** + RLS recursion fix                                                                                                  |
| `029_proposal_instant_review_and_author_edit.sql` | Instant proposal decisions, author delete pending, DM notification links — **applied on Supabase** (`proposal_instant_review_and_author_edit`) |


Without `**media_assets`** bucket and non-recursive `conversation_participants` policies, profile uploads and DMs return **400/500**.

---

## External / manual (cannot finish in app code alone)

### Apple Push Notifications (APNs) — SSL / keys

Production push requires Apple + Expo configuration (not only in-app notification rows):

1. **Apple Developer** → [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources) → **Keys** → create an **APNs** key (`.p8`), note **Key ID** and **Team ID**.
2. **Expo / EAS** → project credentials → upload the APNs key (or let EAS manage with `eas credentials`).
3. **App** → `expo-notifications` in a **production** build (not Expo Go); request permission after sign-in.
4. **Supabase** (optional) → store device tokens via `device_push_tokens` + edge function for server-triggered push.
5. **Pass updates** (Wallet): if passes use **web service URL** for updates, that endpoint must use **HTTPS with a valid TLS certificate** (often the same server cert as your API). See Apple [PassKit Web Service Reference](https://developer.apple.com/documentation/walletpasses/adding_a_web_service_to_update_passes).

Docs: `docs/APPLE_PUSH_SSL_SETUP.md`, `docs/INTEGRATIONS.md`.

### How to obtain a CSR (Certificate Signing Request)

Apple asks for a CSR when you create some **certificate-based** credentials (Wallet Pass Type ID signing, legacy push certs, etc.). APNs often uses a **Key** (`.p8`) instead — no CSR for that path.

**On macOS:**

1. Open **Keychain Access**.
2. Menu **Keychain Access** → **Certificate Assistant** → **Request a Certificate From a Certificate Authority…**
3. Enter your email and a **Common Name** (e.g. `Dalton Wallet Signing`).
4. Select **Saved to disk** → you get a `.certSigningRequest` file.
5. Go to [Apple Developer → Certificates](https://developer.apple.com/account/resources/certificates/list) (or the Pass Type ID / Services flow) → **Create** the cert type you need → **Upload CSR** → choose that file.
6. Download the issued `.cer`, double-click to add it to Keychain. Export as `.p12` if your pass-signing server or tool requires it (Keychain → certificate → Export).

**Without a Mac:** use OpenSSL on Linux/WSL to generate a key + CSR, or use a teammate’s Mac for the one-time CSR step.

### Apple Wallet — Pass Type ID & signing certificates

To issue **Add to Wallet** event tickets (`.pkpass`):

1. **Pass Type ID** — Developer portal → **Identifiers** → **Pass Type IDs** → register e.g. `pass.com.daltongroup.access.event`.
2. **Certificate** — Create a **Pass Type ID Certificate** (signing); download `.cer`, export `**.p12`** with a password for your signer service.
3. **WWDR** — Install Apple **WWDR intermediate** on the machine that signs passes.
4. **App ID / entitlements** — Enable Wallet capability on the iOS app; associate the Pass Type ID.
5. **Signing pipeline** — Server builds `pass.json` + assets, signs with OpenSSL/`signpass`/node-passbook, returns `.pkpass` after booking confirmed.
6. **Web service (optional)** — `webServiceURL` + `authenticationToken` for push-updated passes; host must serve **HTTPS** (TLS 1.2+).

Alternative: **Pass2U** or another vendor API (see `docs/WHAT_NEXT_DETAILED_PENDING.md`). QR check-in validation remains on your backend (`docs/QR_CHECKIN.md`).

### Apple Wallet event tickets (Path B in docs)

- Pass Type ID, signing certs, `.pkpass` delivery
- Or **Pass2U** / vendor API (see `docs/WHAT_NEXT_DETAILED_PENDING.md`)
- Server must issue pass after confirmed booking; app opens add-to-wallet flow
- QR check-in still validated on your backend (`docs/QR_CHECKIN.md`)

### Apple Push Notifications (production)

- APNs key in Expo/EAS, `expo-notifications` in production build
- `docs/APPLE_PUSH_SSL_SETUP.md`, `docs/INTEGRATIONS.md`
- App now suppresses **system banners while foregrounded**; in-app list + badges handle open app
- Optional: `expo-haptics` ping when in-app notification arrives (partial — wire in `ActivityBadgeProvider`)

### App Store / Play release

- EAS production profiles, store listings, screenshots (`docs/APP_STORE_METADATA.md`, `docs/STORE_RELEASE.md`)
- RevenueCat products linked (`docs/REVENUECAT.md`)

### Stripe live keys

- Event paid checkout edge functions + webhook secrets in Supabase/Vercel
- Test with sandbox first (`docs/BILLING_SANDBOX_TESTING.md`)

### OAuth production

- Apple + Google redirect URLs and Services ID (`docs/OAUTH_APPLE_GOOGLE.md`)

---

## Priority backlog (in-repo)

### High (product correctness)


| Item                                | Status                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `media_assets` storage bucket + RLS | Migration 027 — **apply on prod**                                        |
| DM / messages 500 (RLS recursion)   | Migration 027 — **apply on prod**                                        |
| Delete own posts                    | Confirm modal + feed removal (code); verify `posts_delete_author` policy |
| Redeploy web bundle after fixes     | User must hard-refresh / redeploy (`npx expo export` / Vercel)           |
| Profile avatar/banner upload        | Depends on bucket + policies                                             |


### Medium (UX / growth)


| Item                                     | Status                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| Create post wizard                       | **Done** — `CreateCommunityPostWizard`                                       |
| Comments bottom sheet                    | **Done** — `PostCommentsSheet`                                               |
| Notification icons + deep links          | **Done** — `notificationNavigation.ts`                                       |
| Activity badges (bell / messages / tab)  | **Done** — `ActivityBadgeProvider`                                           |
| Master outreach message template         | **Done** — `proposalOutreachMessage.ts`                                      |
| Highlight video modal (not media player) | **Done** — `HighlightVideoModal`                                             |
| Smart back on wizards                    | **Done** — `useWizardBack` on create post; extend to other wizards as needed |
| Per-conversation unread message count    | Inbox uses last-seen timestamp; refine with read receipts later              |
| Server-side premium gates                | Migration cancelled earlier — revisit if paywall bypass reported             |


### Low (polish)


| Item                                  | Status                             |
| ------------------------------------- | ---------------------------------- |
| Accessibility pass on profile screens | Cancelled earlier — still open     |
| Pass2U / Wallet MVP                   | Not started                        |
| Sentry source maps on EAS             | `docs/MONITORING_AND_ANALYTICS.md` |
| Realtime read receipts for DMs        | Optional enhancement               |


---

## Deploy checklist after pulling latest `main`

1. Apply migrations **024–028** on Supabase project `txehbzyntvqpkkegjrwp`.
2. Confirm bucket: `select id from storage.buckets where id = 'media_assets';`
3. Rebuild and deploy web: `cd expo-app && npx expo export --platform web` (or your Vercel pipeline).
4. Hard-refresh browser (Ctrl+Shift+R) — old bundles still call `media_assets(...)` embed on messages.
5. Smoke test: delete post, DM send, avatar upload, notification tap, create post wizard.

---

## Known 400/401 class issues (root causes)


| Symptom                                         | Typical cause                                         | Fix                                    |
| ----------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| Storage **400** on `media_assets/...`           | Missing bucket or insert policy                       | Migration 027                          |
| REST **500** on messages / media                | RLS infinite recursion on `conversation_participants` | Migration 027                          |
| Old JS still shows `select=*,media_assets(...)` | Stale deployed web bundle                             | Redeploy + cache bust                  |
| Delete appears to do nothing                    | Web `Alert` confirm + RLS deny                        | `ConfirmModal` + `posts_delete_author` |


---

## Beyond this file — hardcoded, manual, or production gaps

Items easy to miss because they are scattered in code or other docs:

| Area | What to fix / complete |
|------|-------------------------|
| **Demo auth** | **Done in code** — release builds never accept bundled passwords; `__DEV__` + `EXPO_PUBLIC_DEV_DEMO_*` only when Supabase unset. |
| **Bundle / brand ID** | `com.hc111.daltondemo` in `eas.json` / `app.config.js` — align with production **The Dalton Grant Academy** bundle ID and display name. |
| **Legal HTML** | Operator **The Dalton Grant Academy** + `daltongrantacademy.vercel.app` — **counsel review still required** (`docs/CUSTOMER_DOCUMENTATION.md`). |
| **Web help site** | `help-center.html` on Vercel — expand FAQs; in-app Help centre now links legal pages (search: `terms`, `privacy`). |
| **Community demo posts** | `communityScreens.tsx` still embeds **picsum.photos** sample cards when feed is empty — remove for production or show empty state only. |
| **Media search demo** | **Done** — demo tiles only in `__DEV__`, screenshot mode, or `EXPO_PUBLIC_ALLOW_MEDIA_SEARCH_DEMO=1`. |
| **Events HTML fallback** | `eventsScreens.tsx` parses legacy HTML mock dates — prefer Supabase-only events in production. |
| **Screenshot / store samples** | `appStoreScreenshotSamples.ts` — demo sponsors/events for `EXPO_PUBLIC_APP_STORE_SCREENSHOTS=1` only. |
| **Android cleartext** | **Done** — off unless `EXPO_PUBLIC_ANDROID_ALLOW_CLEARTEXT=true`. |
| **MFA** | Settings shows TOTP **coming soon** — implement or hide from store screenshots. |
| **Push** | `device_push_tokens` + APNs key + production build — not Expo Go. |
| **Wallet passes** | `.pkpass` signing or Pass2U — not started (`WHAT_NEXT_DETAILED_PENDING.md`). |
| **Paid events** | `stripe_price_id` on events + edge functions + live Stripe keys. |
| **RevenueCat** | Product IDs in dashboard must match app (`docs/REVENUECAT.md`). |
| **Realtime** | Enable Supabase replication on `posts` for live feed. |
| **Sentry** | Set `EXPO_PUBLIC_SENTRY_DSN` on EAS/Vercel; console.error forwarding in release (`GO_LIVE_CHECKLIST.md`). Source maps: `SENTRY_ORG` / `SENTRY_PROJECT` on EAS. |
| **Master control** | `MASTER_CONTROL.env` / profile flag — operational, not in repo secrets. |
| **Resend** | Email smoke test uses placeholder API key until `RESEND_API_KEY` set. |
| **OAuth redirects** | Production Apple/Google URLs (`OAUTH_APPLE_GOOGLE.md`). |
| **Privacy labels** | App Store Connect data collection questionnaire vs actual SDKs (Supabase, RevenueCat, Sentry). |
| **DSA trader** | Business name, address, support email in Connect must match website legal footer. |

Full launch checklist: [`SUBMISSION_READINESS.md`](./SUBMISSION_READINESS.md).


