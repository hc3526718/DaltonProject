# Live data & messaging

## Production behavior

When Supabase is configured and the user is signed in (not `demo-*`):

- **Community feed**, events, media, and profiles load from Supabase only.
- **Messages inbox** lists real `conversations` / `messages`; compose picks from your following list.
- **DM policy** is enforced server-side (`can_message_peer`, `get_or_create_dm`) and in-app via Privacy → Direct messages.
- **In-app notifications** persist until you clear them; new rows arrive via Realtime on `in_app_notifications`.
- **DM sends** create an in-app notification for the recipient (DB trigger `trg_notify_recipient_on_dm`).

## Screenshot / marketing mode only

Set in `expo-app/.env`:

```env
EXPO_PUBLIC_APP_STORE_SCREENSHOTS=1
```

This merges sample inbox threads, coach demo thread bubbles, sample events/media, and demo notification rows. Do **not** enable in production builds.

## Database

Apply migrations through `018_messaging_policy_and_dm_notify.sql` (or Supabase MCP). Ensure Realtime is enabled for `messages` and `in_app_notifications` in the Supabase dashboard if live updates do not appear.
