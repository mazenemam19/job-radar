// src/lib/cron/fetch-jobs.ts
// Builds one fetch task per (company, pipeline) combination, runs them
// concurrency-limited against a caller-supplied deadline, and aggregates
// the results into jobs + per-source health. Extracted from runner.ts to
// keep runCronJob's own complexity down.

import { fetchCompany } from "../ats-bridge";
import type { ATSCompanyRow, CronRunResult, RawJob, JobMode } from "../types";

const CONCURRENCY_LIMIT = 8; // max parallel ATS fetches

/** Simple concurrency limiter */
export async function withConcurrencyLimit<T>(
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

interface FetchTaskResult {
  company: string;
  mode: JobMode;
  jobs: RawJob[];
  error: string | null;
}

export interface FetchAllCompanyJobsResult {
  allJobs: RawJob[];
  sourceHealth: CronRunResult["source_health"];
  errors: string[];
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
  const tasks: Array<() => Promise<FetchTaskResult>> = [];

  for (const row of companies) {
    if (row.pipeline_local) tasks.push(makeFetchTask(row, "local", deadline));
    if (row.pipeline_global) tasks.push(makeFetchTask(row, "global", deadline));
  }

  const fetchResults = await withConcurrencyLimit(tasks, CONCURRENCY_LIMIT);

  const allJobs: RawJob[] = [];
  const sourceHealth: CronRunResult["source_health"] = {};
  const errors: string[] = [];

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
  }

  return { allJobs, sourceHealth, errors };
}
