-- Small Germany-pilot intake with a live, profile-specific role check.
-- Company country is catalog context only: matching always uses each
-- posting's normalized location and eligibility evidence. Leave `city` null
-- so a company office cannot replace an individual posting's location.
--
-- Apply manually through Supabase SQL Editor. The insert is idempotent when
-- the catalog already contains a matching provider slug or company name.

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
from (
  values
    ('NetBird', 'ashby', 'netbird', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Hawk', 'ashby', 'hawk', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Manex AI', 'ashby', 'manex', 'Germany', '🇩🇪', null::text, false, true, true)
) as source(
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
where not exists (
  select 1
  from public.ats_companies as existing
  where lower(existing.slug) = lower(source.slug)
     or lower(existing.name) = lower(source.name)
);
