// src/lib/cron/upsert-raw-jobs.ts
// Batch-upserts fetched jobs into public.raw_jobs, deduplicating within each
// chunk (Postgres rejects ON CONFLICT DO UPDATE if the same key appears
// twice in one statement). Extracted from runner.ts to keep runCronJob's
// own complexity down.

import type { createAdminClient } from "../supabase/admin";
import type { RawJob } from "../types";

const CHUNK_SIZE = 500; // stay under Supabase's row limit per statement

type AdminDb = ReturnType<typeof createAdminClient>;

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
 * Upserts all fetched jobs into public.raw_jobs in chunks of CHUNK_SIZE.
 * INSERT ... ON CONFLICT (id) DO UPDATE — updates fetched_at to keep jobs
 * fresh. This is the deduplication mechanism: same URL hash = same id.
 * Returns one error string per chunk that failed.
 */
export async function upsertRawJobs(db: AdminDb, jobs: RawJob[]): Promise<string[]> {
  if (jobs.length === 0) return [];

  const errors: string[] = [];
  const rows = jobs.map(toRawJobRow);

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
