-- Filter each user's location and job-type preferences before applying the row
-- limit. Unknown country, workplace, or employment data remains reviewable.
-- The original RPC is retained for compatibility with older app builds.

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
  with cutoff as (
    select now() - make_interval(days => greatest(p_job_age_days, 0)) as ts
  ),
  patterns as materialized (
    select
      public.jr_word_boundary_pattern(p_all_level_terms)      as all_level_pat,
      public.jr_word_boundary_pattern(p_selected_level_terms) as sel_level_pat,
      public.jr_word_boundary_pattern(p_excluded_terms)       as excluded_pat,
      public.jr_word_boundary_pattern(p_global_blocked_terms) as blocked_pat
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
  mode_scoped as (
    select * from public.raw_jobs where mode = any(p_modes)
  ),
  after_date as (
    select ms.* from mode_scoped ms, cutoff
    where (ms.date_unknown and ms.fetched_at >= cutoff.ts)
       or (not ms.date_unknown and coalesce(ms.posted_at, ms.fetched_at) >= cutoff.ts)
  ),
  base as (
    select ad.*
    from after_date ad, patterns, preferences
    where
      (
        patterns.all_level_pat is null
        or not (ad.title ~* patterns.all_level_pat or ad.description ~* patterns.all_level_pat)
        or (
          patterns.sel_level_pat is not null
          and (ad.title ~* patterns.sel_level_pat or ad.description ~* patterns.sel_level_pat)
        )
      )
      and (patterns.excluded_pat is null or ad.title !~* patterns.excluded_pat)
      and (
        p_blacklist_terms is null or array_length(p_blacklist_terms, 1) is null
        or not exists (
          select 1 from unnest(p_blacklist_terms) as bl
          where (ad.title || ' ' || ad.description || ' ' || ad.location) ilike ('%' || bl || '%')
        )
      )
      and (
        p_required_terms is null or array_length(p_required_terms, 1) is null
        or exists (
          select 1 from unnest(p_required_terms) as rk
          where (ad.title || ' ' || ad.description || ' ' || ad.location) ilike ('%' || rk || '%')
        )
      )
      and (
        p_skill_terms is not null and array_length(p_skill_terms, 1) is not null
        and exists (
          select 1 from unnest(p_skill_terms) as sk
          where ad.description ilike ('%' || sk || '%')
        )
      )
      and (
        ad.mode <> 'global'
        or (
          p_global_allowed_terms is not null and array_length(p_global_allowed_terms, 1) is not null
          and exists (
            select 1 from unnest(p_global_allowed_terms) as ga
            where (ad.title || ' ' || ad.description || ' ' || ad.location) ilike ('%' || ga || '%')
          )
        )
        or (
          patterns.blocked_pat is null
          or not (
            ad.title ~* patterns.blocked_pat
            or ad.description ~* patterns.blocked_pat
            or ad.location ~* patterns.blocked_pat
          )
        )
      )
      -- An empty selection leaves a dimension unrestricted. Unknown workplace
      -- and employment type stay visible so users can review the source text.
      and (
        cardinality(preferences.workplace_types) = 0
        or ad.workplace_type = 'unknown'
        or ad.workplace_type = any(preferences.workplace_types)
      )
      and (
        cardinality(preferences.employment_types) = 0
        or coalesce(cardinality(ad.employment_types), 0) = 0
        or ad.employment_types && preferences.employment_types
      )
      -- A missing country is uncertain, so retain it. Otherwise a posting must
      -- match one selected country, a selected city, or an enabled country-wide
      -- workplace option.
      and (
        jsonb_array_length(preferences.locations) = 0
        or ad.country_code is null
        or exists (
          select 1
          from jsonb_array_elements(preferences.locations) as preferred_location
          where upper(preferred_location->>'country_code') = upper(ad.country_code)
            and (
              ad.city is null
              or exists (
                select 1
                from jsonb_array_elements_text(
                  case when jsonb_typeof(preferred_location->'cities') = 'array'
                    then preferred_location->'cities' else '[]'::jsonb end
                ) as preferred_city
                where lower(trim(preferred_city)) = lower(trim(ad.city))
              )
              or (
                ad.workplace_type = 'remote'
                and preferred_location->>'remote_countrywide' = 'true'
              )
              or (
                ad.workplace_type in ('on_site', 'hybrid')
                and preferred_location->>'country_wide' = 'true'
              )
            )
        )
      )
  ),
  limited as (
    select * from base order by fetched_at desc limit greatest(p_limit, 0)
  )
  select jsonb_build_object(
    'jobs', coalesce((select jsonb_agg(to_jsonb(limited.*)) from limited), '[]'::jsonb),
    'funnel', jsonb_build_object(
      'total_fetched', (select count(*) from mode_scoped),
      'after_date_filter', (select count(*) from after_date),
      'after_settings_filter_coarse', (select count(*) from base)
    )
  );
$$;

comment on function public.jr_get_filtered_raw_jobs_for_profile(
  text[], int, text[], text[], text[], text[], text[], text[], text[], text[], jsonb, int
) is 'DB-level filtering with per-user location and job-type preferences applied before the row limit. Unknown attributes remain visible.';

revoke all on function public.jr_get_filtered_raw_jobs_for_profile(
  text[], int, text[], text[], text[], text[], text[], text[], text[], text[], jsonb, int
) from public, anon, authenticated;
grant execute on function public.jr_get_filtered_raw_jobs_for_profile(
  text[], int, text[], text[], text[], text[], text[], text[], text[], text[], jsonb, int
) to service_role;
