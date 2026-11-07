// Removes stale, untracked raw postings after each successful cron scrape.
// A tracker snapshot is the user's durable record, so those job IDs are never
// eligible for deletion here.

import type { createAdminClient } from "../supabase/admin";

export const RAW_JOB_RETENTION_DAYS = 90;

type AdminDb = ReturnType<typeof createAdminClient>;

export type RawJobPruneResult =
  | { ok: true; deletedCount: number; cutoff: string }
  | { ok: false; error: string; cutoff: string };

export function rawJobRetentionCutoff(
  now = new Date(),
  retentionDays = RAW_JOB_RETENTION_DAYS,
): string {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff.toISOString();
}

/**
 * Deletes jobs which have not appeared in any scrape for the retention
 * window. The database function excludes tracked IDs atomically, avoiding a
 * race between a dashboard save and an application-side select/delete pair.
 */
export async function pruneStaleUntrackedRawJobs(
  db: AdminDb,
  now = new Date(),
): Promise<RawJobPruneResult> {
  const cutoff = rawJobRetentionCutoff(now);

  // @ts-expect-error -- added by tracked SQL migration; regenerate DB types
  // after applying supabase/migrations/20261107700000_prune_stale_raw_jobs.sql.
  const { data, error } = await db.rpc("jr_prune_stale_untracked_raw_jobs", {
    p_cutoff: cutoff,
  });

  if (error) return { ok: false, error: error.message, cutoff };

  return { ok: true, deletedCount: Number(data ?? 0), cutoff };
}
