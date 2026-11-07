// src/lib/cron/upsert-raw-jobs.ts
// Batch-upserts fetched jobs into public.raw_jobs, deduplicating within each
// chunk (Postgres rejects ON CONFLICT DO UPDATE if the same key appears
// twice in one statement). Extracted from runner.ts to keep runCronJob's
// own complexity down.

import type { createAdminClient } from "../supabase/admin";
import type { RawJob } from "../types";

const CHUNK_SIZE = 500; // stay under Supabase's row limit per statement

type AdminDb = ReturnType<typeof createAdminClient>;

const LEGACY_PIPELINE_PREFIX = /^(?:local|global|visa)_/;
const LEGACY_PIPELINE_NAMES = ["local", "global", "visa"] as const;

function toRawJobRow(j: RawJob) {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    country: j.country,
    country_flag: j.country_flag,
    url: j.url,
    description: j.description,
    posted_at: j.posted_at,
    fetched_at: j.fetched_at,
    date_unknown: j.date_unknown,
    is_remote: j.is_remote,
    salary: j.salary,
    mode: j.mode,
    visa_sponsorship: j.visa_sponsorship,
    source_name: j.source_name,
    ats_type: j.ats_type,
    created_at: j.created_at,
    source_location: j.source_location ?? j.location,
    country_code: j.country_code ?? null,
    city: j.city ?? null,
    workplace_type: j.workplace_type ?? "unknown",
    employment_types: j.employment_types ?? [],
    work_authorization_status:
      j.work_authorization_status ?? (j.visa_sponsorship ? "sponsorship_available" : "unclear"),
    work_authorization_evidence: j.work_authorization_evidence ?? null,
    language_requirements: j.language_requirements ?? [],
    language_evidence: j.language_evidence ?? null,
  };
}

function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/**
 * IDs written before the canonical-ID rollout included a pipeline prefix.
 * Look for every possible historical spelling of the provider ID before an
 * upsert so deploying the writer before the one-time rekey cannot duplicate
 * a posting already in raw_jobs.
 */
function transitionCandidateIds(job: RawJob): string[] {
  if (!job.source_id?.trim()) return [];

  const providerId = job.source_id.trim();
  const withoutPrefix = providerId.replace(LEGACY_PIPELINE_PREFIX, "");
  return Array.from(
    new Set([
      job.id,
      providerId,
      withoutPrefix,
      ...LEGACY_PIPELINE_NAMES.map((mode) => `${mode}_${withoutPrefix}`),
    ]),
  );
}

async function findExistingTransitionIds(
  db: AdminDb,
  jobs: RawJob[],
): Promise<{ ids: Set<string>; error: string | null }> {
  const candidateIds = Array.from(new Set(jobs.flatMap(transitionCandidateIds)));
  if (candidateIds.length === 0) return { ids: new Set(), error: null };

  const ids = new Set<string>();
  // Keep PostgREST's generated URL comfortably below proxy limits.
  const LOOKUP_CHUNK_SIZE = 200;
  for (let i = 0; i < candidateIds.length; i += LOOKUP_CHUNK_SIZE) {
    const { data, error } = await db
      .from("raw_jobs")
      .select("id")
      .in("id", candidateIds.slice(i, i + LOOKUP_CHUNK_SIZE));

    if (error) return { ids, error: error.message };
    for (const row of data ?? []) ids.add(row.id);
  }

  return { ids, error: null };
}

function applyTransitionIds(jobs: RawJob[], existingIds: Set<string>) {
  return jobs.map((job) => {
    const existingId = transitionCandidateIds(job).find((candidate) => existingIds.has(candidate));
    return { ...toRawJobRow(job), id: existingId ?? job.id };
  });
}

/**
 * Upserts all fetched jobs into public.raw_jobs in chunks of CHUNK_SIZE.
 * INSERT ... ON CONFLICT (id) DO UPDATE — updates fetched_at to keep jobs
 * fresh. This is the deduplication mechanism: same URL hash = same id.
 * Returns one error string per chunk that failed.
 */
export async function upsertRawJobs(db: AdminDb, jobs: RawJob[]): Promise<string[]> {
  if (jobs.length === 0) return [];

  const errors: string[] = [];
  const transition = await findExistingTransitionIds(db, jobs);
  if (transition.error) {
    // Do not switch an existing posting to a new ID blindly. Missing one
    // transition lookup is recoverable; duplicating tracked jobs is not.
    return [`Skipped raw-job upsert because the legacy ID lookup failed: ${transition.error}`];
  }

  const rows = applyTransitionIds(jobs, transition.ids);

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = dedupeById(rows.slice(i, i + CHUNK_SIZE));
    const { error } = await db.from("raw_jobs").upsert(chunk, {
      onConflict: "id",
      ignoreDuplicates: false, // we want to update fetched_at
    });

    if (error) {
      errors.push(`Upsert chunk ${i}-${i + CHUNK_SIZE}: ${error.message}`);
    }
  }

  return errors;
}
