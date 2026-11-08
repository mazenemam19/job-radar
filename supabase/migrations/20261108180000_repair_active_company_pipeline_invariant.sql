-- An active ATS company with neither source pipeline is invisible to cron:
-- no task is queued and no skip is logged. These legacy rows have therefore
-- behaved as inactive even though the admin page says otherwise. Mark them
-- inactive until an admin explicitly verifies their intended pipeline.
update public.ats_companies
set
  is_active = false,
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
