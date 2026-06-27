// src/lib/runner.ts
// New cron orchestrator for Job Radar.
//
// Key differences from old runner.ts (src/lib/runner.ts):
//  1. Reads company list from public.ats_companies DB table (not hardcoded ALL_COMPANIES)
//  2. Writes jobs to public.raw_jobs (not the old `storage` table)
//  3. After a successful run, bumps app_config.last_cron_at so all user caches
//     are invalidated and rebuilt lazily on next dashboard load
//  4. All bug fixes (#3-#6) are applied in scoring.ts; runner is just the orchestrator
//
// This file is IMPORTED by /api/cron/route.ts and never modifies old files.

import { createAdminClient } from "./supabase/admin";
import { fetchCompany } from "./ats-bridge";
import {
  loadWorkableStateFromDB,
  flushWorkable429sToDB,
  flushDomainCountsToDB,
} from "./sources/ats-utils";
import type { ATSCompanyRow, CronRunResult, RawJob } from "./types";

const CONCURRENCY_LIMIT = 8; // max parallel ATS fetches

/** Simple concurrency limiter */
async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p: Promise<void> = task().then((r) => {
      results.push(r);
    });
    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
      // Remove settled promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const state = await Promise.race([
          executing[i].then(() => "done").catch(() => "done"),
          Promise.resolve("pending"),
        ]);
        if (state === "done") executing.splice(i, 1);
      }
    }
  }

  await Promise.allSettled(executing);
  return results;
}

// ── Main cron function ───────────────────────────────────────

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
  const errors: string[] = [];
  const sourceHealth: CronRunResult["source_health"] = {};

  // 1. Load active companies
  const { data: companies, error: companiesError } = await db
    .from("ats_companies")
    .select("*")
    .eq("is_active", true);

  // Load Workable rate-limit state (blocked slugs, budget config) from the DB
  // before fetching anything — this is what actually persists it across runs,
  // since serverless invocations don't share memory or /tmp.
  await loadWorkableStateFromDB();

  if (companiesError || !companies?.length) {
    const msg = companiesError?.message ?? "No active companies found";
    errors.push(`Failed to load companies: ${msg}`);
    return {
      total_fetched: 0,
      duration_ms: Date.now() - startMs,
      errors,
      source_health: {},
      trigger,
    };
  }

  // 2. Build fetch tasks — one per (company, pipeline) combination
  const tasks: Array<
    () => Promise<{
      company: string;
      mode: "visa" | "local" | "global";
      jobs: RawJob[];
      error: string | null;
    }>
  > = [];

  for (const row of companies as ATSCompanyRow[]) {
    if (row.pipeline_visa) tasks.push(() => fetchCompany(row, "visa"));
    if (row.pipeline_local) tasks.push(() => fetchCompany(row, "local"));
    if (row.pipeline_global) tasks.push(() => fetchCompany(row, "global"));
  }

  // 3. Execute with concurrency limit
  const fetchResults = await withConcurrencyLimit(tasks, CONCURRENCY_LIMIT);

  // 4. Aggregate results and track source health
  const allJobs: RawJob[] = [];

  for (const result of fetchResults) {
    const healthKey = `${result.company}:${result.mode}`;
    if (result.error) {
      errors.push(`${result.company} (${result.mode}): ${result.error}`);
      sourceHealth[healthKey] = {
        company: result.company,
        fetched: 0,
        errors: 1,
      };
    } else {
      allJobs.push(...result.jobs);
      sourceHealth[healthKey] = {
        company: result.company,
        fetched: result.jobs.length,
        errors: 0,
      };
    }
  }

  // 5. Upsert into raw_jobs
  // INSERT ON CONFLICT (id) DO UPDATE — updates fetched_at to keep jobs fresh.
  // This is the deduplication mechanism: same URL hash = same id.
  if (allJobs.length > 0) {
    const rows = allJobs.map((j) => ({
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
    }));

    // Batch upsert in chunks of 500 to avoid Supabase row limits.
    // Deduplicate within each chunk first — different companies can
    // produce jobs with the same URL hash, and PostgreSQL rejects
    // ON CONFLICT DO UPDATE if the same key appears twice in one statement.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const seen = new Set<string>();
      const deduped = chunk.filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
      const { error: upsertError } = await db.from("raw_jobs").upsert(deduped, {
        onConflict: "id",
        ignoreDuplicates: false, // we want to update fetched_at
      });

      if (upsertError) {
        errors.push(`Upsert chunk ${i}-${i + CHUNK}: ${upsertError.message}`);
      }
    }
  }

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
  // No job listings included — users open the dashboard to see their
  // personalized (post-Gemini) results. This avoids the mismatch where
  // email showed pre-Gemini jobs but the dashboard later filtered them.
  const companiesScanned = companies?.length ?? 0;
  if (companiesScanned > 0) {
    const { data: eligibleUsers } = await db
      .from("user_profiles")
      .select("email, user_settings(email_alerts_enabled)")
      .eq("is_active", true)
      .eq("onboarding_complete", true); // exclude users who haven't finished setup

    if (eligibleUsers?.length) {
      const { sendNewScanNotificationEmail } = await import("@/lib/email");
      for (const raw of eligibleUsers) {
        const u = raw as Record<string, unknown>;
        const settings = u.user_settings as { email_alerts_enabled: boolean | null } | null;
        // Default to false when the settings row is missing — no explicit opt-in,
        // no email. (A missing row means onboarding wasn't completed, which the
        // query above already guards against, but this is a safe second layer.)
        const emailAlertsEnabled = settings?.email_alerts_enabled ?? false;

        if (emailAlertsEnabled && u.email) {
          await sendNewScanNotificationEmail(companiesScanned, u.email as string);
        }
      }
    }
  }

  return {
    total_fetched: allJobs.length,
    duration_ms: durationMs,
    errors,
    source_health: sourceHealth,
    trigger,
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
