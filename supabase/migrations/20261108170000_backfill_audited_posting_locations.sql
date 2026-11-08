-- Correct only posting locations with unambiguous, audited evidence that the
-- original location normalizer missed because ATS wrappers put the city after
-- "Office -" / "Remote -". Regional labels such as Global and EMEA are not
-- guesses and intentionally remain unresolved.
--
-- This is idempotent and preserves source_location. It does not use a
-- company's headquarters country to classify an individual posting.

with classified as (
  select
    job.id,
    case
      when coalesce(job.source_location, job.location) ~* '\m(san francisco|new york|chicago|seattle|austin|boston|california)\M' then 'US'
      when coalesce(job.source_location, job.location) ~* '\m(manila|philippines)\M' then 'PH'
      else null
    end as country_code,
    case
      when coalesce(job.source_location, job.location) ~* '\msan francisco\M' then 'San Francisco'
      when coalesce(job.source_location, job.location) ~* '\mnew york\M' then 'New York'
      when coalesce(job.source_location, job.location) ~* '\mchicago\M' then 'Chicago'
      when coalesce(job.source_location, job.location) ~* '\mseattle\M' then 'Seattle'
      when coalesce(job.source_location, job.location) ~* '\maustin\M' then 'Austin'
      when coalesce(job.source_location, job.location) ~* '\mboston\M' then 'Boston'
      when coalesce(job.source_location, job.location) ~* '\mmanila\M' then 'Manila'
      else null
    end as city
  from public.raw_jobs as job
  where job.country_code is null
)
update public.raw_jobs as job
set
  country_code = classified.country_code,
  country = case classified.country_code when 'US' then 'USA' when 'PH' then 'Philippines' end,
  country_flag = case classified.country_code when 'US' then '🇺🇸' when 'PH' then '🇵🇭' end,
  city = coalesce(job.city, classified.city)
from classified
where job.id = classified.id
  and classified.country_code is not null;
