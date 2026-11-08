-- Keep the date filter index-friendly as users change the dashboard duration.
-- Splitting the date_unknown/coalesce predicate lets Postgres use the existing
-- mode/fetched_at and partial mode/posted_at indexes instead of scanning a
-- growing age window before the profile result is capped.

create or replace function public.jr_get_filtered_raw_jobs_for_profile(
  p_modes text[], p_job_age_days int, p_all_level_terms text[],
  p_selected_level_terms text[], p_excluded_terms text[], p_required_terms text[],
  p_skill_terms text[], p_blacklist_terms text[], p_global_allowed_terms text[],
  p_global_blocked_terms text[], p_search_profile jsonb, p_limit int default 2000
)
returns jsonb language sql stable as $$
  with cutoff as materialized (
    select now() - make_interval(days => greatest(p_job_age_days, 0)) as ts
  ), preferences as materialized (
    select
      case when jsonb_typeof(p_search_profile->'locations') = 'array' then p_search_profile->'locations' else '[]'::jsonb end as locations,
      case when jsonb_typeof(p_search_profile->'workplace_types') = 'array' then array(select jsonb_array_elements_text(p_search_profile->'workplace_types')) else '{}'::text[] end as workplace_types,
      case when jsonb_typeof(p_search_profile->'employment_types') = 'array' then array(select jsonb_array_elements_text(p_search_profile->'employment_types')) else '{}'::text[] end as employment_types
  ), after_date as materialized (
    select job.id, job.fetched_at, job.workplace_type, job.employment_types, job.country_code, job.city
    from public.raw_jobs as job, cutoff
    where job.mode = any(p_modes) and job.date_unknown and job.fetched_at >= cutoff.ts
    union all
    select job.id, job.fetched_at, job.workplace_type, job.employment_types, job.country_code, job.city
    from public.raw_jobs as job, cutoff
    where job.mode = any(p_modes) and not job.date_unknown
      and job.posted_at is not null and job.posted_at >= cutoff.ts
    union all
    select job.id, job.fetched_at, job.workplace_type, job.employment_types, job.country_code, job.city
    from public.raw_jobs as job, cutoff
    where job.mode = any(p_modes) and not job.date_unknown
      and job.posted_at is null and job.fetched_at >= cutoff.ts
  ), after_workplace as materialized (
    select job.* from after_date as job, preferences
    where cardinality(preferences.workplace_types) = 0
      or job.workplace_type = 'unknown' or job.workplace_type = any(preferences.workplace_types)
  ), after_employment as materialized (
    select job.* from after_workplace as job, preferences
    where cardinality(preferences.employment_types) = 0
      or coalesce(cardinality(job.employment_types), 0) = 0
      or job.employment_types && preferences.employment_types
  ), after_location as materialized (
    select job.* from after_employment as job, preferences
    where jsonb_array_length(preferences.locations) = 0 or job.country_code is null
      or exists (
        select 1 from jsonb_array_elements(preferences.locations) as preferred_location
        where upper(preferred_location->>'country_code') = upper(job.country_code)
          and (job.city is null
            or exists (
              select 1 from jsonb_array_elements_text(
                case when jsonb_typeof(preferred_location->'cities') = 'array' then preferred_location->'cities' else '[]'::jsonb end
              ) as preferred_city
              where lower(trim(preferred_city)) = lower(trim(job.city))
            )
            or (job.workplace_type = 'remote' and preferred_location->>'remote_countrywide' = 'true')
            or (job.workplace_type in ('on_site', 'hybrid') and preferred_location->>'country_wide' = 'true'))
      )
  ), limited as materialized (
    select id, fetched_at from after_location
    order by fetched_at desc, id desc
    limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'jobs', coalesce((
      select jsonb_agg(to_jsonb(job) order by limited.fetched_at desc, limited.id desc)
      from limited join public.raw_jobs as job using (id)
    ), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'total_fetched', (select count(*) from public.raw_jobs where mode = any(p_modes)),
      'after_date_filter', (select count(*) from after_date),
      'after_workplace_filter', (select count(*) from after_workplace),
      'after_employment_filter', (select count(*) from after_employment),
      'after_location_filter', (select count(*) from after_location)
    )
  );
$$;
