-- A small number of ATS postings provide only a regional location while their
-- title explicitly names Germany. Preserve the regional source_location, but
-- classify the posting country from that explicit evidence. Concrete source
-- locations always take precedence and are not touched by this migration.

update public.raw_jobs as job
set
  country_code = 'DE',
  country = 'Germany',
  country_flag = '🇩🇪'
where job.country_code is null
  and coalesce(job.source_location, job.location) ~* '\m(emea|global|worldwide|any office|multiple locations|remote|anywhere)\M'
  and job.title ~* '\m(germany|deutschland)\M';
