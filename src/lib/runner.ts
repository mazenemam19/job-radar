// src/lib/runner.ts
// Cron orchestrator: fetches jobs from all ATS sources, scores them,
// persists to raw_jobs, and sends scan-complete emails.

import { createAdminClient } from "./supabase/admin";
import { fetchAllCompanyJobs } from "./cron/fetch-jobs";
import { upsertRawJobs } from "./cron/upsert-raw-jobs";
import { sendScanNotifications } from "./cron/send-scan-notifications";
import {
  loadWorkableStateFromDB,
  flushWorkable429sToDB,
  flushDomainCountsToDB,
} from "./sources/ats-utils";
import type { ATSCompanyRow, CronRunResult } from "./types";

// ── Main cron function ───────────────────────────────────────

// Vercel Hobby + Fluid Compute caps this route at 300s (see maxDuration in
// src/app/api/cron/route.ts) — there is no larger number to reach for on
// this plan. 270s leaves a 30s buffer for the upsert/email/logging steps
// that run after the fetch phase, so a slow fetch phase degrades to partial
// results instead of the whole run getting hard-killed mid-upsert.
const FETCH_TIME_BUDGET_MS = 270_000;

/**
 * Runs the global cron job:
 *  1. Fetches all active companies from public.ats_companies
 *  2. Calls ATS fetchers in parallel (concurrency-limited)
 *  3. Upserts all fetched jobs into public.raw_jobs
 *     (INSERT ... ON CONFLICT (id) DO UPDATE SET fetched_at = NOW())
 *  4. Bumps app_config.last_cron_at → invalidates all user caches
 *  5. Logs the run in public.cron_logs_v2
 *
 * User-specific Gemini filtering happens lazily on dashboard load ("Lazy C").
 */
export async function runCronJob(
  trigger: "github_actions" | "vercel_cron" | "manual",
): Promise<CronRunResult> {
  const db = createAdminClient();
  const startMs = Date.now();
  console.log(`[cron] run started (trigger=${trigger})`);

  // 1. Load active companies
  const { data: companies, error: companiesError } = await db
    .from("ats_companies")
    .select("*")
    .eq("is_active", true);
  console.log(
    `[cron] loaded ${companies?.length ?? 0} active companies (+${Date.now() - startMs}ms)`,
  );

  // Load Workable rate-limit state (blocked slugs, budget config) from the DB
  // before fetching anything — this is what actually persists it across runs,
  // since serverless invocations don't share memory or /tmp.
  await loadWorkableStateFromDB();
  console.log(`[cron] workable state loaded (+${Date.now() - startMs}ms)`);

  if (companiesError || !companies?.length) {
    const msg = companiesError?.message ?? "No active companies found";
    return {
      total_fetched: 0,
      duration_ms: Date.now() - startMs,
      errors: [`Failed to load companies: ${msg}`],
      source_health: {},
      trigger,
    };
  }

  // 2-4. Fetch from every (company, pipeline) combination, concurrency-limited,
  // degrading to partial results if the fetch phase runs past its time budget.
  const deadline = startMs + FETCH_TIME_BUDGET_MS;
  console.log(
    `[cron] fetch phase starting, deadline in ${deadline - Date.now()}ms (+${Date.now() - startMs}ms)`,
  );
  const { allJobs, sourceHealth, errors } = await fetchAllCompanyJobs(
    companies as ATSCompanyRow[],
    deadline,
  );
  console.log(
    `[cron] fetch phase done: ${allJobs.length} jobs, ${errors.length} errors (+${Date.now() - startMs}ms)`,
  );

  // 5. Upsert into raw_jobs (chunked, deduplicated within each chunk)
  errors.push(...(await upsertRawJobs(db, allJobs)));
  console.log(`[cron] upsert done (+${Date.now() - startMs}ms)`);

  // 6. Bump app_config.last_cron_at → invalidates all user_jobs_cache entries
  const { error: configError } = await db
    .from("app_config")
    .update({ last_cron_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", 1);

  if (configError) {
    errors.push(`Failed to update app_config: ${configError.message}`);
  }

  // Persist any Workable 429s detected this run, so the next run actually
  // skips those companies instead of hammering them again immediately.
  await flushWorkable429sToDB();

  // Persist domain request counts for rate-limiting accuracy across runs.
  await flushDomainCountsToDB();

  const durationMs = Date.now() - startMs;

  // 7. Log the cron run
  await db.from("cron_logs_v2").insert({
    run_at: new Date().toISOString(),
    total_fetched: allJobs.length,
    duration_ms: durationMs,
    errors: errors.length ? errors : null,
    source_health: sourceHealth,
    trigger,
  });

  // 8. Send "scan complete" notification to all eligible users.
  const { emailResults, errors: emailErrors } = await sendScanNotifications(
    db,
    companies?.length ?? 0,
  );
  errors.push(...emailErrors);

  return {
    total_fetched: allJobs.length,
    duration_ms: durationMs,
    errors,
    source_health: sourceHealth,
    trigger,
    email_results: emailResults,
  };
}

// ── Per-user dashboard rebuild ────────────────────────────────

/**
 * Checks if the user's job cache is stale (older than the last cron run).
 * If stale, returns false so the dashboard can trigger a rebuild.
 */
export async function isCacheFresh(userId: string): Promise<boolean> {
  const db = createAdminClient();

  const [{ data: config }, { data: cache }] = await Promise.all([
    db.from("app_config").select("last_cron_at").eq("id", 1).single(),
    db.from("user_jobs_cache").select("cached_at").eq("user_id", userId).single(),
  ]);

  if (!cache?.cached_at) return false;
  if (!config?.last_cron_at) return true; // no cron run yet

  return cache.cached_at > config.last_cron_at;
}
