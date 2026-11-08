-- An active ATS company with neither source pipeline is invisible to cron:
-- no task is queued and no skip is logged. These legacy rows are retained as
-- active sources and assigned the global pipeline, which is the existing
-- catch-all source pool. Their individual posting locations still determine
-- whether they can match a user's country profile.
update public.ats_companies
set
  pipeline_global = true,
  updated_at = now()
where is_active = true
  and coalesce(pipeline_local, false) = false
  and coalesce(pipeline_global, false) = false;

-- Keep direct database writes aligned with the API validation. NOT VALID is
-- intentional: it avoids a table scan during deployment while enforcing the
-- invariant for all future inserts and updates.
alter table public.ats_companies
  add constraint ats_companies_active_requires_pipeline
  check (
    is_active = false
    or coalesce(pipeline_local, false)
    or coalesce(pipeline_global, false)
  ) not valid;
