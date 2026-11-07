-- Personal, location-agnostic target market and role preferences.
-- Empty lists mean "no restriction"; no country is selected globally.

alter table public.user_settings
  add column if not exists search_profile jsonb not null
    default '{"locations":[],"workplace_types":[],"employment_types":[]}'::jsonb;

comment on column public.user_settings.search_profile is
  'Per-user target countries/cities, workplace arrangements, and employment categories.';
