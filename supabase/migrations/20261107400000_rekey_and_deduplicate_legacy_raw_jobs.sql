-- Replace legacy pipeline-specific job IDs with a source-stable hash and
-- collapse records fetched through more than one historical pipeline.
--
-- Some old fetchers used `local_`, `global_`, or `visa_` as an ID prefix,
-- even though they represented the same provider posting. The current
-- ingestion code removes that prefix before hashing the provider ID.
--
-- Keep the newest snapshot for every provider identity. Existing Gemini
-- reviews are moved before deletion, and the foreign key is made update
-- cascading so reviews survive the ID rekey.

begin;

alter table public.user_job_gemini_reviews
  drop constraint if exists user_job_gemini_reviews_job_id_fkey;

alter table public.user_job_gemini_reviews
  add constraint user_job_gemini_reviews_job_id_fkey
  foreign key (job_id)
  references public.raw_jobs(id)
  on delete cascade
  on update cascade;

-- When one user has a review on both a retained and duplicate legacy row,
-- retain the review already attached to the newest retained snapshot.
with ranked as (
  select
    id,
    ats_type,
    regexp_replace(id, '^(local|global|visa)_', '') as source_identity,
    row_number() over (
      partition by ats_type, regexp_replace(id, '^(local|global|visa)_', '')
      order by fetched_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.raw_jobs
), review_moves as (
  select
    duplicate_review.user_id,
    duplicate_review.job_id as duplicate_job_id,
    winner.id as winner_job_id
  from public.user_job_gemini_reviews as duplicate_review
  join ranked as duplicate_row on duplicate_row.id = duplicate_review.job_id
  join ranked as winner
    on winner.ats_type = duplicate_row.ats_type
   and winner.source_identity = duplicate_row.source_identity
   and winner.row_number = 1
  where duplicate_row.row_number > 1
)
delete from public.user_job_gemini_reviews as existing_winner
using review_moves
where existing_winner.user_id = review_moves.user_id
  and existing_winner.job_id = review_moves.winner_job_id;

with ranked as (
  select
    id,
    ats_type,
    regexp_replace(id, '^(local|global|visa)_', '') as source_identity,
    row_number() over (
      partition by ats_type, regexp_replace(id, '^(local|global|visa)_', '')
      order by fetched_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.raw_jobs
), review_moves as (
  select
    duplicate_review.job_id as duplicate_job_id,
    winner.id as winner_job_id
  from public.user_job_gemini_reviews as duplicate_review
  join ranked as duplicate_row on duplicate_row.id = duplicate_review.job_id
  join ranked as winner
    on winner.ats_type = duplicate_row.ats_type
   and winner.source_identity = duplicate_row.source_identity
   and winner.row_number = 1
  where duplicate_row.row_number > 1
)
update public.user_job_gemini_reviews as review
set job_id = review_moves.winner_job_id
from review_moves
where review.job_id = review_moves.duplicate_job_id;

with ranked as (
  select
    id,
    row_number() over (
      partition by ats_type, regexp_replace(id, '^(local|global|visa)_', '')
      order by fetched_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from public.raw_jobs
)
delete from public.raw_jobs as job
using ranked
where job.id = ranked.id
  and ranked.row_number > 1;

with rekeyed as (
  select
    id,
    ats_type || '_' || substr(
      encode(
        extensions.digest(
          ats_type || ':' || regexp_replace(id, '^(local|global|visa)_', ''),
          'sha256'
        ),
        'hex'
      ),
      1,
      40
    ) as canonical_id
  from public.raw_jobs
)
update public.raw_jobs as job
set id = rekeyed.canonical_id
from rekeyed
where job.id = rekeyed.id
  and job.id <> rekeyed.canonical_id;

-- Cached result JSON contains job IDs, so force a normal safe rebuild rather
-- than serve stale links after the rekey.
update public.user_jobs_cache
set cached_at = '2000-01-01T00:00:00Z';

commit;
