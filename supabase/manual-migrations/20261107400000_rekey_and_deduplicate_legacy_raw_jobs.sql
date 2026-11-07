-- MANUAL OPERATION ONLY — do not move into supabase/migrations.
--
-- Run only after taking a verified backup and pausing the job-fetch cron.
-- This one-time transaction replaces local_/global_/visa_ raw job IDs with
-- the canonical provider hash. It preserves the newest tracker state and
-- Gemini review for each user/posting before duplicate raw rows are removed.

begin;

-- Map both legacy and already-created canonical rows to one canonical ID.
-- The second case lets this cleanup safely repair a database where a newer
-- writer ran before the manual migration.
create temporary table jr_raw_job_rekey_map on commit drop as
select
  job.id as old_id,
  case
    when job.id ~ '^(local|global|visa)_' then
      job.ats_type || '_' || substr(
        encode(
          extensions.digest(
            job.ats_type || ':' || regexp_replace(job.id, '^(local|global|visa)_', ''),
            'sha256'
          ),
          'hex'
        ),
        1,
        40
      )
    else job.id
  end as canonical_id,
  job.fetched_at,
  job.created_at
from public.raw_jobs as job;

-- Prefer an existing canonical row. Otherwise retain the freshest legacy
-- snapshot before changing its ID.
create temporary table jr_raw_job_rekey_winners on commit drop as
select old_id, canonical_id
from (
  select
    mapping.*,
    row_number() over (
      partition by mapping.canonical_id
      order by
        case when mapping.old_id = mapping.canonical_id then 0 else 1 end,
        mapping.fetched_at desc nulls last,
        mapping.created_at desc nulls last,
        mapping.old_id desc
    ) as row_number
  from jr_raw_job_rekey_map as mapping
) as ranked
where row_number = 1;

-- Keep review rows connected while changing raw_jobs.id below.
alter table public.user_job_gemini_reviews
  drop constraint if exists user_job_gemini_reviews_job_id_fkey;

alter table public.user_job_gemini_reviews
  add constraint user_job_gemini_reviews_job_id_fkey
  foreign key (job_id)
  references public.raw_jobs(id)
  on delete cascade
  on update cascade;

-- Keep one review per user/posting. A review already on the selected raw-job
-- winner takes precedence; otherwise a stable job-ID tie-breaker is
-- enough because the table permits only one review per user and job ID.
create temporary table jr_gemini_review_rekey_map on commit drop as
select review_ctid, winner_job_id, row_number
from (
  select
    review.ctid as review_ctid,
    winner.old_id as winner_job_id,
    row_number() over (
      partition by review.user_id, mapping.canonical_id
      order by case when review.job_id = winner.old_id then 0 else 1 end, review.job_id desc
    ) as row_number
  from public.user_job_gemini_reviews as review
  join jr_raw_job_rekey_map as mapping on mapping.old_id = review.job_id
  join jr_raw_job_rekey_winners as winner on winner.canonical_id = mapping.canonical_id
) as ranked;

delete from public.user_job_gemini_reviews as review
using jr_gemini_review_rekey_map as mapping
where review.ctid = mapping.review_ctid
  and mapping.row_number > 1;

update public.user_job_gemini_reviews as review
set job_id = mapping.winner_job_id
from jr_gemini_review_rekey_map as mapping
where review.ctid = mapping.review_ctid
  and mapping.row_number = 1
  and review.job_id <> mapping.winner_job_id;

-- tracker_entries has no raw_jobs foreign key. Retain the most recently
-- changed state for a user/posting before updating its independently stored
-- job_id to the canonical value.
create temporary table jr_tracker_rekey_map on commit drop as
select id, canonical_id, row_number
from (
  select
    entry.id,
    mapping.canonical_id,
    row_number() over (
      partition by entry.user_id, mapping.canonical_id
      order by entry.last_status_change desc nulls last, entry.updated_at desc nulls last, entry.id desc
    ) as row_number
  from public.tracker_entries as entry
  join jr_raw_job_rekey_map as mapping on mapping.old_id = entry.job_id
) as ranked;

delete from public.tracker_entries as entry
using jr_tracker_rekey_map as mapping
where entry.id = mapping.id
  and mapping.row_number > 1;

update public.tracker_entries as entry
set
  job_id = mapping.canonical_id,
  updated_at = now()
from jr_tracker_rekey_map as mapping
where entry.id = mapping.id
  and mapping.row_number = 1
  and entry.job_id <> mapping.canonical_id;

-- Remove every raw duplicate before updating winner IDs. The foreign key
-- above cascades the final ID change into any retained Gemini reviews.
delete from public.raw_jobs as job
using jr_raw_job_rekey_map as mapping
join jr_raw_job_rekey_winners as winner on winner.canonical_id = mapping.canonical_id
where job.id = mapping.old_id
  and mapping.old_id <> winner.old_id;

update public.raw_jobs as job
set id = winner.canonical_id
from jr_raw_job_rekey_winners as winner
where job.id = winner.old_id
  and job.id <> winner.canonical_id;

-- Cached result JSON contains raw-job IDs; force normal safe rebuilds.
update public.user_jobs_cache
set cached_at = '2000-01-01T00:00:00Z';

commit;
