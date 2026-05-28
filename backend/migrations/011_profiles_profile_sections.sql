-- Profile sections / customization fields (bio, interests, banner, sport context for results).
-- These power Profile tab cells without hardcoded demo content.

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists primary_sport text;

-- Optional “recommended” sections: allow structured storage (can be empty).
alter table public.profiles add column if not exists highlights jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists recent_results jsonb not null default '[]'::jsonb;

