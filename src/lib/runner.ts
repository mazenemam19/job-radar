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
import { loadKnownWorkableJobsFromDB } from "./sources/ats/known-jobs";
import type { ATSCompanyRow, CronRunResult } from "./types";

// ── Main cron function ───────────────────────────────────────

// Vercel Hobby + Fluid Compute caps this route at 300s (see maxDuration in
// src/app/api/cron/route.ts) — there is no larger number to reach for on
// this plan. FETCH_TIME_BUDGET_MS only ever stops *new* company fetches from
// being queued (see makeFetchTask in cron/fetch-jobs.ts) — already-dispatched
// fetches are left to run to completion, so on its own this number was never
// a guarantee the fetch phase actually finished by 270s. HARD_FETCH_CUTOFF_MS
// below is what makes that a real guarantee to the rest of runCronJob.
const FETCH_TIME_BUDGET_MS = 270_000;

// The actual ceiling on how long runCronJob waits for the fetch phase before
// moving on with whatever's been fetched so far (see fetchAllCompanyJobs'
// hardCutoffAt param). Deliberately set below FETCH_TIME_BUDGET_MS, not at
// or above it: fetches still in flight when this hits keep running in the
// background rather than being cancelled (Vercel Fluid Compute keeps the
// invocation alive after the response is sent, up to maxDuration), so this
// number governs what the *caller* waits for, while FETCH_TIME_BUDGET_MS
// separately governs when that background continuation stops queueing more
// work on its own. Landing this below 270s buys the upsert/app_config/log/
// email steps below a full 50s of margin under the 300s ceiling instead of
// the 30s they had when 270s was the only number in play.
const HARD_FETCH_CUTOFF_MS = 250_000;

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

  // Load descriptions for Workable jobs already on file, so fetchWorkable can
  // skip re-fetching a detail page it already has the text for — this is
  // most of the request volume that trips Workable's rate limiter in the
  // first place (see docs/solutions/bugs/Issue 52 504 recurrence part6).
  await loadKnownWorkableJobsFromDB();
  console.log(`[cron] known workable jobs loaded (+${Date.now() - startMs}ms)`);

  if (companiesError || !companies?.length) {
    const msg = companiesError?.message ?? "No active companies found";
    return {
      total_fetched: 0,
      duration_ms: Date.now() - startMs,
      errors: [`Failed to load companies: ${msg}`],
      warnings: [],
      source_health: {},
      trigger,
    };
  }

  // 2-4. Fetch from every (company, pipeline) combination, concurrency-limited,
  // degrading to partial results if the fetch phase runs past its time budget.
  const deadline = startMs + FETCH_TIME_BUDGET_MS;
  const hardCutoffAt = startMs + HARD_FETCH_CUTOFF_MS;
  console.log(
    `[cron] fetch phase starting, deadline in ${deadline - Date.now()}ms, ` +
      `hard cutoff in ${hardCutoffAt - Date.now()}ms (+${Date.now() - startMs}ms)`,
  );
  const { allJobs, sourceHealth, errors, warnings } = await fetchAllCompanyJobs(
    companies as ATSCompanyRow[],
    deadline,
    hardCutoffAt,
  );
  console.log(
    `[cron] fetch phase done: ${allJobs.length} jobs, ${errors.length} errors, ${warnings.length} warnings (+${Date.now() - startMs}ms)`,
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
    console.error(
      `[cron] app_config update failed: ${configError.message} (+${Date.now() - startMs}ms)`,
    );
  } else {
    console.log(`[cron] app_config updated (+${Date.now() - startMs}ms)`);
  }

  // Persist any Workable 429s detected this run, so the next run actually
  // skips those companies instead of hammering them again immediately.
  await flushWorkable429sToDB();
  console.log(`[cron] workable 429 flush done (+${Date.now() - startMs}ms)`);

  // Persist domain request counts for rate-limiting accuracy across runs.
  await flushDomainCountsToDB();
  console.log(`[cron] domain counts flush done (+${Date.now() - startMs}ms)`);

  const durationMs = Date.now() - startMs;

  // 7. Log the cron run
  const { error: logError } = await db.from("cron_logs_v2").insert({
    run_at: new Date().toISOString(),
    total_fetched: allJobs.length,
    duration_ms: durationMs,
    errors: errors.length ? errors : null,
    warnings: warnings.length ? warnings : null,
    source_health: sourceHealth,
    trigger,
  });

  if (logError) {
    // Nothing left to push this into — cron_logs_v2 IS the error sink. This
    // is the one failure in the whole function that only console.error can
    // carry, which is exactly why it needs its own explicit line: a silent
    // failure here is indistinguishable from a hard kill with no trace at
    // all (see docs/solutions/bugs/issue-52-504-recurrence-part3.md).
    console.error(
      `[cron] cron_logs_v2 insert failed: ${logError.message} (+${Date.now() - startMs}ms)`,
    );
  } else {
    console.log(`[cron] cron_logs_v2 insert done (+${Date.now() - startMs}ms)`);
  }

  // 8. Send "scan complete" notification to all eligible users.
  console.log(`[cron] email phase starting (+${Date.now() - startMs}ms)`);
  const { emailResults, errors: emailErrors } = await sendScanNotifications(
    db,
    companies?.length ?? 0,
  );
  errors.push(...emailErrors);
  console.log(`[cron] run complete (+${Date.now() - startMs}ms)`);

  return {
    total_fetched: allJobs.length,
    duration_ms: durationMs,
    errors,
    warnings,
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
