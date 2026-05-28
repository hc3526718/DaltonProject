-- Remove per-user "hide from feed" storage (feature retired in the app).
-- Idempotent: no error if the table was never created.

drop table if exists public.user_feed_hides cascade;
