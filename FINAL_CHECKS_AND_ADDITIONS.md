# Final Checks and Additions

## Simple list of fixes/implementations

- **Community feed is now live (Supabase posts + realtime).**
  - Why: So all users can post and see updates in real time.

- **Event booking now saves real rows (`events` + `bookings`) for signed-in users.**
  - Why: Bookings are now real data, not only UI.

- **In-app notifications are now DB-backed.**
  - Why: You can load, mark read, and manage real notifications.

- **Follow request backend is added (tables + RPC actions).**
  - Why: Needed for safe accept/reject/cancel flows.

- **Follow requests screen was added in Settings.**
  - Why: Users can now manage incoming/outgoing requests in-app.

- **Messaging RLS was tightened to conversation members only.**
  - Why: Prevents non-participants from reading/sending messages.

- **Messaging service now supports get-or-create DM + conversation summaries.**
  - Why: Enables practical 1:1 chat instead of demo-only behavior.

- **Message thread now loads/sends real messages when conversation data exists.**
  - Why: Moves chat toward production behavior.

- **Auth startup was improved to avoid long stalls.**
  - Why: Reduces cases where users get stuck before app navigation.

- **Sentry `supabase_get_session_timeout` handling was improved.**
  - Why: Still reports slow sessions, but app UI unlocks faster.

- **OAuth redirect parsing was improved + better debug logging.**
  - Why: Helps resolve "No authorization code in redirect" issues.

- **Boot Rive now defaults to bundled `assets/dalton_animated_logo.riv` on dev client/EAS.**
  - Why: Uses your local animation by default and reduces embed/network dependency.

## Manual setup still required

- **Run SQL files in Supabase (order):**
  1. `backend/roadmap_extensions.sql`
  2. `backend/rls_policies.sql`
  3. `backend/rpc_get_or_create_dm.sql`
  4. `backend/rpc_follow_requests.sql`
  - Why: App code depends on these tables/policies/functions.

- **OAuth redirect URL must include:**
  - `dalton-demo://auth/callback`
  - Why: Required for Google/Apple OAuth code/session exchange.

- **Ensure env vars are set for the build being tested (`.env` + EAS env).**
  - Why: Missing build-time vars can break auth and runtime behavior.

- **Summary email on booking still needs backend sender setup (Edge Function + Resend/SendGrid).**
  - Why: Email sending must be server-side.

## Quick verification checklist

- Log in with email/password and confirm you leave the login screen.
- Post in Community and verify live update.
- Book an event and confirm booking row is created.
- Open Notifications and verify DB-backed rows.
- Open Settings -> Follow requests and test accept/reject.
- Open Messages and send a DM in a real conversation.

## What’s still needed to submit to the App Store (manual tasks)

This section is distilled from: `docs/WHAT_NEXT.md`, `docs/REMAINING_TASKS_PLAYBOOK.md`, `docs/OAUTH_APPLE_GOOGLE.md`, `docs/STORE_RELEASE.md`, `docs/REVENUECAT.md`, `docs/QR_CHECKIN.md`, `docs/INTEGRATIONS.md`.

**Baseline platform check (revisit whenever you change schema or build profiles):**

- [x] **Supabase** — SQL/RLS/RPC path is aligned with the app; adjust policies and migrations as features evolve.
- [x] **Expo** — dev-client / native-module expectations are understood; iterate with `app.json` and native deps.
- [x] **EAS** — build profiles and env baking are the source of truth for TestFlight/App Store; keep keys in sync.

### Supabase (database + auth)

- **Apply the latest `backend/rls_policies.sql` after `backend/roadmap_extensions.sql`.**
  - Why: Your current DB has RLS enabled + policies for `events` and `in_app_notifications`, but it is **missing** RLS/policies for:
    - `conversations`
    - `conversation_participants`
    - `follows`
    - `follow_requests`
  - Result if you skip: messaging + follow requests won’t be secure / won’t work consistently.

- **Add `events.created_by` column (recommended) and re-apply RLS.**
  - Run: `backend/migration_add_events_created_by.sql` (then re-run `backend/rls_policies.sql`).
  - Why: Needed to restrict “staff check-in” and other host tools to the account that created the event.

- **Run RPC SQL in Supabase SQL editor:**
  - `backend/rpc_get_or_create_dm.sql`
  - `backend/rpc_follow_requests.sql`
  - Why: The app calls these RPCs for “create DM” and “accept/reject/cancel follow request”.

- **Enable Realtime for the tables you want “live”.**
  - At minimum: `posts` (community live feed).
  - Optional later: `in_app_notifications`, `messages` (if you want live updates without refresh).
  - Why: Realtime isn’t automatically enabled per table.

- **Auth redirect URLs (required for Google OAuth).**
  - Add `dalton-demo://auth/callback` in Supabase → Auth → URL Configuration.
  - If using Expo Go for Google: also add the `exp://…/--/auth/callback` URLs from `docs/OAUTH_APPLE_GOOGLE.md`.
  - Why: If it’s missing/mismatched you’ll see “No authorization code in redirect”.

- **Email deliverability + templates (recommended before release).**
  - Configure Supabase email provider / templates and verify email confirmations.
  - Why: App Store review often tests basic auth flows; broken email flows will fail.

### Expo / EAS (build + env)

- **Build a dev client for native modules (Apple Sign-In, RevenueCat, native Rive, future camera scanner).**
  - Why: Expo Go cannot run those native modules reliably (see `docs/OAUTH_APPLE_GOOGLE.md` + `docs/STORE_RELEASE.md`).

- **Set build-time env vars for each EAS profile (development/preview/production).**
  - Why: Missing build-time vars is the most common cause of “works in Expo Go but not in dev build”.

### RevenueCat (subscriptions)

- **Create products in App Store Connect (and Play Console if Android).**
  - Why: RevenueCat offerings reference store products; you can’t test/ship without them.

- **RevenueCat dashboard setup**
  - Create **Entitlement**: `premium`
  - Create **Offering**: set a “Current” offering and attach products
  - Why: The app checks `premium` entitlement id.

- **Set keys as build-time env vars**
  - `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS`
  - `EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID`
  - Why: Purchases are skipped in Expo Go and require a native build.

- **(Optional but recommended) Webhook to your backend**
  - Why: Server-side “truth” lets you enforce premium features reliably.

### Apple Wallet event passes

- **Choose a pass strategy and set up signing:**
  - **Fastest:** Pass2U (or similar hosted pass issuer)
  - **Most control:** self-signed `.pkpass` service (Pass Type ID + cert management)
  - Why: Wallet passes must be generated/signed server-side; the app should only download/open the pass.

### Push notifications (if you want them at launch)

- **Expo push tokens**
  - Ensure `device_push_tokens` table exists + RLS policy (already in `roadmap_extensions.sql` but you must apply policy).
  - Why: Needed to target pushes to a user/device.

- **Apple / Android push credentials**
  - iOS: APNs key/cert in Apple Developer + configured for your app
  - Android: FCM setup (google-services config)
  - Why: Without these, pushes won’t arrive on real devices.

- **In-app notification UX (iOS)**
  - Ask for permission at the right time (after onboarding, not on first frame).
  - Use push for “wake-up” and also store rows in `in_app_notifications` for the in-app list.
  - Why: Push can be missed; the in-app inbox should still show the source of truth.

### App Store Connect (iOS submission)

- **Create the app record**
  - Bundle ID must match: `com.hc111.daltondemo`
  - Why: Must match what you build/sign.

- **App info**
  - Name, subtitle, category, age rating, support URL, privacy policy URL
  - Why: Required metadata for submission.

- **Privacy**
  - Fill in App Privacy details (“nutrition label”)
  - Why: Mandatory to submit.

- **Screenshots + preview**
  - iPhone (and iPad if you support it)
  - Why: Mandatory for App Store listing.

- **Sign-in for review**
  - Provide a working test account + instructions in “App Review Information”
  - Why: Reviewers must be able to access core features.

- **If you sell subscriptions**
  - Provide subscription details + review notes
  - Why: Required for IAP review.

### EAS / build + release plumbing

- **Confirm build-time env vars are set in EAS**
  - Supabase URL/anon key, OAuth settings, RevenueCat keys, Sentry DSN, etc.
  - Why: Dev build can behave differently from Expo Go if vars weren’t baked in.

- **Create an App Store build**
  - Use EAS build profile for production
  - Why: TestFlight/App Store needs a signed archive.

### Sentry (optional but recommended)

- **Upload sourcemaps for production builds**
  - Why: Without sourcemaps, Sentry issues are harder to fix during review/beta.

## “Live feature” structures still to build (in-app)

These are the next app-level building blocks to make features fully live across users/devices.

### Community: like / comment / share (live)

- **Likes**
  - What to build: `post_likes` insert/delete + show live like count per post.
  - Why: Current UI uses demo counts; live likes are needed for real engagement.

- **Comments**
  - What to build: `post_comments` list + create + count per post.
  - Why: Comments are a core social loop and feed ranking signal later.

- **Realtime**
  - What to build: enable Realtime for `posts` (and optionally `post_likes` / `post_comments`).
  - Why: Live updates without forcing refresh.

### Messages (live)

- What to build: show only real threads + realtime message updates (optional).
- Why: Current inbox merges live and demo; for production you’ll remove demo data and rely on DB.

### Notifications (live + push)

- What to build:
  - “Notification producer” backend (Edge Function or DB trigger) that inserts into `in_app_notifications`.
  - Push sender (Expo push API) for time-sensitive alerts.
- Why: Without a producer, the in-app list stays empty and push won’t exist.

### Refresh (pull-to-refresh) on main pages

- What to build: add pull-to-refresh on any scroll feed that shows live data (events list, messages, notifications, follow requests).
- Why: Gives users an “escape hatch” if realtime is off or the network stalls.

### QR tickets (unique per event) + staff scanning

- What to build:
  - Include `eventId` in the QR payload (server-verified in production).
  - Replace token paste with camera scan in a native build.
  - Restrict staff tools to the event creator/host account.
- Why: Prevents the same QR being reused across events; enables real on-site check-in (see `docs/QR_CHECKIN.md`).

### Calendar events (“Add to Calendar”)

- What to build:
  - Keep the current `.ics` share flow (works cross-platform).
  - Optionally add “one-click” calendar links (Google Calendar URL, etc.) similar to CalendarLink-style UX.
- Why: Improves attendance and reduces “what time/where is this?” friction.
