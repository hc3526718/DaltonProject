# Which Supabase schema goes with this app?

## This repo is **Dalton** (The Dalton Grant Academy / expo-app)

- **Source of truth:** [`backend/schema.sql`](../backend/schema.sql)  
- **Profiles:** `public.profiles.id` **is** `auth.users.id` (1:1 primary key), **not** a separate `user_id` column like some other apps.
- **Features implied:** organizations, posts, likes/reactions/comments, DMs (`conversations` / `messages`), `media_assets`, `events`, `bookings`, `subscription_state` (RevenueCat mirror), `allow_messages_from`, `dalton_verified`.

## CoachCraft one-shot SQL (drills / sessions / team channels)

If you pasted SQL labeled **CoachCraft** (drills, `session_drills`, Stripe `subscriptions`, `team_channels`, etc.), that is a **different product**. It does **not** match the Dalton mobile app screens or `backend/schema.sql`. Running it in the same Supabase project as Dalton would create **extra** tables that the Dalton app does not use (unless you intentionally merge products).

**Do not** assume the CoachCraft script “brings the Dalton app up to date.” For Dalton, apply **`backend/schema.sql`**, then [`backend/handle_new_user.sql`](../backend/handle_new_user.sql), then [`backend/rls_policies.sql`](../backend/rls_policies.sql), Storage buckets per [STORAGE.md](./STORAGE.md).

## Aligning auth metadata with the app

The app reads `user_metadata.role` and `dalton_verified` / `daltonVerified` ([BACKEND_AUTH.md](./BACKEND_AUTH.md)). Set these in Supabase Auth for test users or via an admin flow; they are not created by `schema.sql` alone.
