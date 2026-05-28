-- Add metadata fields for media library cards & search.
-- Safe to re-run.

alter table public.media_assets
  add column if not exists title text;

alter table public.media_assets
  add column if not exists description text;

alter table public.media_assets
  add column if not exists tags text[] not null default '{}'::text[];

