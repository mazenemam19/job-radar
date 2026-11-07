-- Germany pilot: verified, live ATS feeds that add posting-level coverage
-- for Munich, Berlin, Frankfurt, Erlangen, and Nuremberg. `city` remains
-- NULL intentionally: matching uses each posting's normalized location, not
-- the employer's headquarters or a catalogue label.
--
-- Apply manually through Supabase SQL Editor. The insert is idempotent for
-- existing catalogues that may already contain a source under the same name
-- or provider slug.

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
    ('Celonis', 'greenhouse', 'celonis', 'Germany', '🇩🇪', null::text, false, true, true),
    ('HIVE', 'greenhouse', 'hive', 'Germany', '🇩🇪', null::text, false, true, true),
    ('KONUX', 'greenhouse', 'konux', 'Germany', '🇩🇪', null::text, false, true, true),
    ('AUTO1 Group', 'greenhouse', 'auto1group', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Attotude', 'greenhouse', 'attotude', 'Germany', '🇩🇪', null::text, false, true, true),
    ('Secfix', 'ashby', 'secfix', 'Germany', '🇩🇪', null::text, false, true, true),
    ('immowelt', 'ashby', 'immowelt', 'Germany', '🇩🇪', null::text, false, true, true),
    ('voize', 'ashby', 'voize', 'Germany', '🇩🇪', null::text, false, true, true),
    (
      'GIANTS Software',
      'smartrecruiters',
      'GIANTSSoftwareGmbH',
      'Germany',
      '🇩🇪',
      null::text,
      false,
      true,
      true
    ),
    ('Ramboll', 'smartrecruiters', 'Ramboll3', 'Germany', '🇩🇪', null::text, false, true, true)
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
