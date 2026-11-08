-- Make the user-facing pipeline funnel reflect the stages already performed
-- by jr_get_filtered_raw_jobs_for_profile. Unknown posting metadata remains
-- intentionally visible rather than being silently treated as a mismatch.

create or replace function public.jr_get_filtered_raw_jobs_for_profile(
  p_modes                text[],
  p_job_age_days          int,
  p_all_level_terms       text[],
  p_selected_level_terms  text[],
  p_excluded_terms        text[],
  p_required_terms        text[],
  p_skill_terms           text[],
  p_blacklist_terms       text[],
  p_global_allowed_terms  text[],
  p_global_blocked_terms  text[],
  p_search_profile        jsonb,
  p_limit                 int default 2000
)
returns jsonb
language sql
stable
as $$
  with cutoff as materialized (
    select now() - make_interval(days => greatest(p_job_age_days, 0)) as ts
  ),
  preferences as materialized (
    select
      case when jsonb_typeof(p_search_profile->'locations') = 'array'
        then p_search_profile->'locations' else '[]'::jsonb end as locations,
      case when jsonb_typeof(p_search_profile->'workplace_types') = 'array'
        then array(select jsonb_array_elements_text(p_search_profile->'workplace_types'))
        else '{}'::text[] end as workplace_types,
      case when jsonb_typeof(p_search_profile->'employment_types') = 'array'
        then array(select jsonb_array_elements_text(p_search_profile->'employment_types'))
        else '{}'::text[] end as employment_types
  ),
  after_date as materialized (
    select job.*
    from public.raw_jobs as job, cutoff
    where job.mode = any(p_modes)
      and (
        (job.date_unknown and job.fetched_at >= cutoff.ts)
        or (not job.date_unknown and coalesce(job.posted_at, job.fetched_at) >= cutoff.ts)
      )
  ),
  after_workplace as materialized (
    select job.*
    from after_date as job, preferences
    where cardinality(preferences.workplace_types) = 0
      or job.workplace_type = 'unknown'
      or job.workplace_type = any(preferences.workplace_types)
  ),
  after_employment as materialized (
    select job.*
    from after_workplace as job, preferences
    where cardinality(preferences.employment_types) = 0
      or coalesce(cardinality(job.employment_types), 0) = 0
      or job.employment_types && preferences.employment_types
  ),
  after_location as materialized (
    select job.*
    from after_employment as job, preferences
    where jsonb_array_length(preferences.locations) = 0
      or job.country_code is null
      or exists (
        select 1
        from jsonb_array_elements(preferences.locations) as preferred_location
        where upper(preferred_location->>'country_code') = upper(job.country_code)
          and (
            job.city is null
            or exists (
              select 1
              from jsonb_array_elements_text(
                case when jsonb_typeof(preferred_location->'cities') = 'array'
                  then preferred_location->'cities' else '[]'::jsonb end
              ) as preferred_city
              where lower(trim(preferred_city)) = lower(trim(job.city))
            )
            or (
              job.workplace_type = 'remote'
              and preferred_location->>'remote_countrywide' = 'true'
            )
            or (
              job.workplace_type in ('on_site', 'hybrid')
              and preferred_location->>'country_wide' = 'true'
            )
          )
      )
  ),
  limited as (
    select *
    from after_location
    order by fetched_at desc
    limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(to_jsonb(limited.*)) from limited), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'total_fetched', (select count(*) from public.raw_jobs where mode = any(p_modes)),
      'after_date_filter', (select count(*) from after_date),
      'after_workplace_filter', (select count(*) from after_workplace),
      'after_employment_filter', (select count(*) from after_employment),
      'after_location_filter', (select count(*) from after_location)
    )
  );
$$;

comment on function public.jr_get_filtered_raw_jobs_for_profile(
  text[], int, text[], text[], text[], text[], text[], text[], text[], text[], jsonb, int
) is 'Returns a profile-bounded raw-job pool and the counts after each server-side date, workplace, employment-type, and location stage. Text gates run in the application.';
