# App Store screenshot sample content

For marketing captures (Apple / Google), the app can show **fictional** sponsors, events, browse media, and community posts without seeding your Supabase database.

## Enable

1. In `expo-app/.env` (create from `.env.example` if needed), set:

   ```bash
   EXPO_PUBLIC_APP_STORE_SCREENSHOTS=1
   ```

2. Restart Metro / rebuild the dev client or EAS build so the env var is bundled.

3. **Turn this off** (`0` or remove the line) before shipping production — the flag is only for capture builds.

## What appears

Defined in `src/data/appStoreScreenshotSamples.ts`:

| Area | Behaviour |
|------|-----------|
| **Sponsors** | Partner cards from `subscription_offer_pages` merge; detail screens resolve by stable sample IDs. |
| **Events** | Upcoming-style rows with relative dates; detail by ID works for samples. |
| **Media** | Browse grid gets sample `media_assets`-shaped rows (Unsplash thumbnails; `storage_path` labels read well in UI). |
| **Community** | Sample posts with avatars and image/video attachments. |
| **Messages** | Inbox threads (Coach Williams, Sarah Chen, Marcus Johnson, Emma Rodriguez) with full thread history; unread/online badges on key rows. |

Samples are merged **ahead of** live Supabase rows (deduped by `id`). Fictional IDs use the `a0000001-…` namespace so they do not collide with normal UUIDs.

## Deletes

With the flag on, deletes for sample sponsor / event / media IDs are ignored so long-press or master actions do not error against the database. Sending a message in a **sample thread** does not persist (screenshot-only); the composer still appears for captures.

## Messages flow

Open **Community → Messages** (inbox icon). Tap **Coach Williams** (or any listed thread) for a multi-bubble boxing coaching conversation. Sample data lives in `src/data/appStoreScreenshotSamples.ts` (`COACH_MSG_TEMPLATES`, etc.).

## Optional: real DB seed

If you prefer real rows instead, run SQL in Supabase as a master user (not covered here); the env flag is the low-friction path for screenshots only.
