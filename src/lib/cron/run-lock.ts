// Database-backed lock for the global cron runner. Serverless instances do
// not share memory, so a module-level boolean cannot protect a manual run
// from overlapping with a scheduled invocation.

import { randomUUID } from "crypto";
import type { createAdminClient } from "../supabase/admin";

const LOCK_STALE_AFTER_SECONDS = 10 * 60;

type AdminDb = ReturnType<typeof createAdminClient>;

export type CronRunLock = { token: string } | null;

/**
 * Acquires the single global cron lock. A stale lock may be recovered after
 * ten minutes, which is safely longer than the route's five-minute limit.
 */
export async function acquireCronRunLock(db: AdminDb): Promise<CronRunLock> {
  const token = randomUUID();

  // @ts-expect-error -- added by the tracked migration below; regenerate DB
  // types after applying it to Supabase.
  const { data, error } = await db.rpc("jr_acquire_cron_run_lock", {
    p_token: token,
    p_stale_after_seconds: LOCK_STALE_AFTER_SECONDS,
  });

  if (error) throw new Error(`Failed to acquire cron run lock: ${error.message}`);

  return data === true ? { token } : null;
}

/** Releases only the lock owned by this invocation. */
export async function releaseCronRunLock(db: AdminDb, lock: CronRunLock): Promise<void> {
  if (!lock) return;

  // @ts-expect-error -- added by the tracked migration below; regenerate DB
  // types after applying it to Supabase.
  const { error } = await db.rpc("jr_release_cron_run_lock", { p_token: lock.token });

  if (error) throw new Error(`Failed to release cron run lock: ${error.message}`);
}
