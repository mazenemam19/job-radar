// src/lib/cron/fetch-jobs.ts
// Builds one fetch task per (company, pipeline) combination, runs them
// concurrency-limited, and aggregates the results into jobs + per-source
// health. Extracted from runner.ts to keep runCronJob's own complexity down.

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
 * Fetches jobs from every (company, pipeline) combination in parallel
 * (concurrency-limited), aggregating jobs, per-source health, and errors.
 */
export async function fetchAllCompanyJobs(
  companies: ATSCompanyRow[],
): Promise<FetchAllCompanyJobsResult> {
  const tasks: Array<() => Promise<FetchTaskResult>> = [];

  for (const row of companies) {
    if (row.pipeline_local) tasks.push(() => fetchCompany(row, "local"));
    if (row.pipeline_global) tasks.push(() => fetchCompany(row, "global"));
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
