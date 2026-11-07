-- Keep raw job storage bounded without deleting a user's tracked records.
-- The cron runs this function with the service-role client after every scrape.

create index if not exists tracker_entries_job_id_idx
  on public.tracker_entries (job_id);

create or replace function public.jr_prune_stale_untracked_raw_jobs(p_cutoff timestamptz)
returns bigint
language sql
set search_path = public
as $$
  with deleted as (
    delete from public.raw_jobs as job
    where job.fetched_at < p_cutoff
      and not exists (
        select 1
        from public.tracker_entries as entry
        where entry.job_id = job.id
      )
    returning job.id
  )
  select count(*)::bigint from deleted;
$$;

revoke all on function public.jr_prune_stale_untracked_raw_jobs(timestamptz) from public;
grant execute on function public.jr_prune_stale_untracked_raw_jobs(timestamptz) to service_role;
