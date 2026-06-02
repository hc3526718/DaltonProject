-- Video series grouping + featured series hero on media library.

alter table public.media_assets
  add column if not exists series_title text;

alter table public.media_assets
  add column if not exists series_part smallint;

alter table public.media_assets
  add column if not exists featured_series boolean not null default false;

create index if not exists media_assets_series_title_idx
  on public.media_assets (series_title)
  where series_title is not null;

create index if not exists media_assets_featured_series_idx
  on public.media_assets (featured_series)
  where featured_series = true;
