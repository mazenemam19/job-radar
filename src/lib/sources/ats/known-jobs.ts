// src/lib/sources/ats/known-jobs.ts
// Run-scoped cache of Workable job descriptions already stored in raw_jobs,
// keyed by raw_jobs.id. Populated once per cron run (loadKnownWorkableJobsFromDB,
// called from runner.ts before dispatch) so fetchWorkable can skip a job's
// detail-page fetch when it already has that job's description on file — see
// docs/solutions/bugs/Issue 52 504 recurrence part6, Task 2. Follows the same
// module-level-cache-plus-loader pattern as run-state.ts, deliberately, so
// fetchWorkable's signature never has to change.

let knownWorkableJobs = new Map<string, string>();

/**
 * Loads every stored Workable job's description into an in-memory map, keyed
 * by raw_jobs.id. One query, scoped to ats_type = 'workable' — not
 * per-company, and not pre-filtered by slug via id string matching, since
 * the shortcode segment of an id isn't known until each company's list call
 * returns.
 */
export async function loadKnownWorkableJobsFromDB(): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const db = createAdminClient();
  const { data, error } = await db
    .from("raw_jobs")
    .select("id, description")
    .eq("ats_type", "workable");
  if (error) {
    console.error("[known-jobs] loadKnownWorkableJobsFromDB select failed:", error.message);
    return;
  }
  knownWorkableJobs = new Map((data ?? []).map((row) => [row.id, row.description]));
}

/**
 * Returns the stored description for a Workable job id already on file, or
 * undefined if this id hasn't been fetched before this run — the caller
 * needs the actual text, not just a boolean, since it's what gets written
 * back to raw_jobs.description on this run's upsert.
 */
export function getKnownWorkableDescription(id: string): string | undefined {
  return knownWorkableJobs.get(id);
}
