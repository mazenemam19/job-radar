// src/lib/cron/fetch-jobs.ts
// Builds one fetch task per (company, pipeline) combination, runs them
// concurrency-limited against a caller-supplied deadline, and aggregates
// the results into jobs + per-source health. Extracted from runner.ts to
// keep runCronJob's own complexity down.

import { fetchCompany } from "../ats-bridge";
import { WORKABLE_LANE_COUNT } from "../sources/ats/workable";
import type { ATSCompanyRow, CronRunResult, RawJob, JobMode } from "../types";

const CONCURRENCY_LIMIT = 8; // max parallel ATS fetches, non-Workable
// Workable dispatch gets its own budget instead of sharing CONCURRENCY_LIMIT
// with every other ATS type. A single Workable company task can occupy a
// slot for up to WORKABLE_MAX_TOTAL_FETCH_MS (90s) while only ever making
// progress through WORKABLE_LANE_COUNT internal lanes — so a batch of
// Workable companies dispatching together (e.g. right after a cooldown
// expires) could previously occupy 5+ of the 8 shared slots for extended
// periods, starving dispatch for unrelated ATS types until the fetch-phase
// deadline passed. Capping Workable's own pool at its lane count means it
// can never hold more global slots than it can actually make use of at
// once. See docs/solutions/bugs/issue-52-504-recurrence-part5.md.
const WORKABLE_CONCURRENCY_LIMIT = WORKABLE_LANE_COUNT;

/**
 * Concurrency limiter using a fixed-size worker pool: `limit` workers each
 * pull the next task off a shared index as soon as they're free, so at most
 * `limit` tasks are ever in flight at once. Results are written back by
 * original index, so the returned array preserves task order regardless of
 * completion order.
 */
export async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

interface FetchTaskResult {
  company: string;
  mode: JobMode;
  jobs: RawJob[];
  error: string | null;
  /** Non-blocking issues from a successful fetch — kept separate from
   * `errors` so a routine caveat (e.g. a few dead job-detail links) doesn't
   * read as equivalent to a real fetch failure. */
  warnings?: string[];
}

export interface FetchAllCompanyJobsResult {
  allJobs: RawJob[];
  sourceHealth: CronRunResult["source_health"];
  errors: string[];
  warnings: string[];
}

/**
 * Wraps a single (company, mode) fetch so the deadline is checked at the
 * moment the task would actually start, not when the task list is built —
 * total elapsed time is only knowable once earlier tasks have run.
 * Past the deadline, returns a skip result with no network call instead of
 * calling fetchCompany, so a slow run degrades to partial results instead
 * of running past the caller's time budget.
 */
function makeFetchTask(
  row: ATSCompanyRow,
  mode: JobMode,
  deadline: number,
): () => Promise<FetchTaskResult> {
  return () => {
    if (Date.now() >= deadline) {
      console.warn(`[cron] ${row.name} (${mode}): skipped — time budget exceeded`);
      return Promise.resolve({
        company: row.name,
        mode,
        jobs: [],
        error: "Skipped — time budget exceeded",
      });
    }
    const t0 = Date.now();
    console.log(`[cron] ${row.name} (${mode}): dispatching (ats=${row.ats})`);
    return fetchCompany(row, mode).then((result) => {
      console.log(`[cron] ${row.name} (${mode}): done in ${Date.now() - t0}ms`);
      return result;
    });
  };
}

/**
 * Fetches jobs from every (company, pipeline) combination in parallel
 * (concurrency-limited), aggregating jobs, per-source health, and errors.
 * Companies not yet dispatched when `deadline` passes are recorded as
 * skipped rather than fetched; already-dispatched fetches are left to
 * finish rather than cancelled, since that work is already sunk.
 */
export async function fetchAllCompanyJobs(
  companies: ATSCompanyRow[],
  deadline: number,
): Promise<FetchAllCompanyJobsResult> {
  const workableTasks: Array<() => Promise<FetchTaskResult>> = [];
  const otherTasks: Array<() => Promise<FetchTaskResult>> = [];

  for (const row of companies) {
    const bucket = row.ats === "workable" ? workableTasks : otherTasks;
    if (row.pipeline_local) bucket.push(makeFetchTask(row, "local", deadline));
    if (row.pipeline_global) bucket.push(makeFetchTask(row, "global", deadline));
  }

  // Two independent pools, not one shared one: Workable's own pool is capped
  // at its internal lane count so it can never crowd out dispatch slots
  // meant for other ATS types (see WORKABLE_CONCURRENCY_LIMIT above).
  const [workableResults, otherResults] = await Promise.all([
    withConcurrencyLimit(workableTasks, WORKABLE_CONCURRENCY_LIMIT),
    withConcurrencyLimit(otherTasks, CONCURRENCY_LIMIT),
  ]);
  const fetchResults = [...workableResults, ...otherResults];

  const allJobs: RawJob[] = [];
  const sourceHealth: CronRunResult["source_health"] = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const result of fetchResults) {
    const healthKey = `${result.company}:${result.mode}`;
    if (result.error) {
      errors.push(`${result.company} (${result.mode}): ${result.error}`);
      sourceHealth[healthKey] = { company: result.company, fetched: 0, errors: 1 };
    } else {
      allJobs.push(...result.jobs);
      sourceHealth[healthKey] = {
        company: result.company,
        fetched: result.jobs.length,
        errors: 0,
      };
    }
    for (const w of result.warnings ?? []) {
      warnings.push(`${result.company} (${result.mode}): ${w}`);
    }
  }

  return { allJobs, sourceHealth, errors, warnings };
}
