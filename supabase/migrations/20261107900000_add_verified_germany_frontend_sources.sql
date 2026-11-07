-- Germany pilot: feeds verified against currently open React/frontend roles.
-- `country` is catalog context only; job matching uses each posting's
-- normalized location and eligibility evidence. Keep `city` null so the
-- employer catalog never substitutes for a posting's actual location.
--
-- Apply manually through Supabase SQL Editor. This is idempotent when a
-- catalog already contains a source with the same name or provider slug.

with sources(
  name,
  ats,
  slug,
  country,
  country_flag,
  city,
  pipeline_local,
  pipeline_global,
  is_active
) as (
  values
    ('ResearchGate', 'lever', 'researchgate', 'Germany', '🇩🇪', null::text, false, true, true),
    ('AMBOSS', 'ashby', 'amboss', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Trading 212', 'ashby', 'trading212', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Plentific', 'ashby', 'plentific', 'Germany', '🇩🇪', null::text, false, true, true),
    (
      'Constructor Tech',
      'greenhouse',
      'constructortech',
      'Germany',
      '🇩🇪',
      null::text,
      false,
      true,
      true
    ),
    ('Almedia', 'ashby', 'almedia', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Peec AI', 'ashby', 'Peec', 'Germany', '🇩🇪', null::text, false, true, true),
    ('bunch', 'ashby', 'bunch', 'Germany', '🇩🇪', null::text, false, true, true)
)
insert into public.ats_companies (
  name,
  ats,
  slug,
  country,
  country_flag,
  city,
  pipeline_local,
  pipeline_global,
  is_active
)
select
  source.name,
  source.ats,
  source.slug,
  source.country,
  source.country_flag,
  source.city,
  source.pipeline_local,
  source.pipeline_global,
  source.is_active
from sources as source
where not exists (
  select 1
  from public.ats_companies as existing
  where lower(existing.slug) = lower(source.slug)
     or lower(existing.name) = lower(source.name)
);
