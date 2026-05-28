# Media & message storage

**Related:** `docs/NEXT_STEPS.md` §1, `backend/schema.sql`, `docs/ACCESS_MODEL.md` (RLS / visibility), `docs/SECRETS_CHECKLIST.md`.

## Pattern

1. **Binary** → Supabase Storage bucket **`media_assets`** (public read; authenticated upload under `profiles/{userId}/`, `posts/`, `events/`, `messages/`, `proposals/`, `catalog/`). Do not use the legacy `media` bucket id in new app code.
2. **Metadata** → Postgres table `media_assets` (see `backend/schema.sql`): `owner_id`, `kind`, `storage_path`, `public_url`, `thumbnail_url`, `post_id`, `message_id`, `visibility`.
3. **Reads** — signed URLs or public CDN URLs depending on `visibility`.
4. **Writes** — presigned upload from app, or Edge Function that validates auth then uploads.

## Limits (Expo)

- Cap upload size client-side before read as blob.
- Video transcoding remains a server job (Mux, FFmpeg on worker, etc.).
