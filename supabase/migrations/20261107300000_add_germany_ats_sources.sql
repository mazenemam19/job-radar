-- Germany pilot: verified Greenhouse boards that add posting-level German coverage.
-- `city` stays NULL because each fetched posting supplies its own normalized location.
-- This is idempotent for manual application to an existing catalog.

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
    ('AutoScout24', 'greenhouse', 'autoscout24', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Alpine Eagle', 'greenhouse', 'alpineeagle', 'Germany', '🇩🇪', null::text, false, true, true),
    (
      'Orcrist Technologies',
      'greenhouse',
      'orcristtechnologies',
      'Germany',
      '🇩🇪',
      null::text,
      false,
      true,
      true
    ),
    ('ecosio', 'greenhouse', 'ecosio', 'Germany', '🇩🇪', null::text, false, true, true),
    ('think-cell', 'greenhouse', 'think-cell', 'Germany', '🇩🇪', null::text, false, true, true)
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
