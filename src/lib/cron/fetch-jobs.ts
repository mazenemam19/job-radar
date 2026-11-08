import { fetchCompany } from "../ats-bridge";
import { WORKABLE_LANE_COUNT } from "../sources/ats/workable";
import {
  buildScheduledTasks,
  recordDispatchCursor,
  sortAndRotateTasks,
  type ScheduledFetchTask,
} from "./dispatch-cursor";
import type { ATSCompanyRow, CronRunResult, JobMode, RawJob } from "../types";

const CONCURRENCY_LIMIT = 8;
const WORKABLE_CONCURRENCY_LIMIT = WORKABLE_LANE_COUNT;

// This is a count of pipeline tasks, not companies: an enabled local and
// global pipeline are separately resumable work items. It keeps each cron
// invocation bounded while the persisted cursor eventually covers the whole
// catalog. Operators can tune it from observed cron duration without deploy.
export const DEFAULT_TASK_BATCH_SIZE = 40;

export function taskBatchSize(value = process.env.CRON_TASK_BATCH_SIZE): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
    ? parsed
    : DEFAULT_TASK_BATCH_SIZE;
}

export async function withConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  return results;
}

interface FetchTaskResult {
  company: string;
  mode: JobMode;
  jobs: RawJob[];
  error: string | null;
  warnings?: string[];
  completed: boolean;
}

export interface FetchAllCompanyJobsResult {
  allJobs: RawJob[];
  sourceHealth: CronRunResult["source_health"];
  errors: string[];
  warnings: string[];
}

function makeFetchTask(
  task: ScheduledFetchTask,
  deadline: number,
  signal: AbortSignal,
  onStart: (task: ScheduledFetchTask) => void,
  onSettle: (task: ScheduledFetchTask, result: FetchTaskResult) => void,
): () => Promise<FetchTaskResult> {
  return async () => {
    const { row, mode } = task;
    if (signal.aborted || Date.now() >= deadline) {
      const result: FetchTaskResult = {
        company: row.name,
        mode,
        jobs: [],
        error: "Skipped — time budget exceeded",
        completed: false,
      };
      onSettle(task, result);
      return result;
    }
    onStart(task);
    const result = await fetchCompany(row, mode, signal);
    const completed: FetchTaskResult = { ...result, completed: !signal.aborted };
    onSettle(task, completed);
    return completed;
  };
}

/** Fetch one bounded, persisted batch. The hard cutoff cancels queued,
 * retrying, and network work through the fetcher signal rather than leaving
 * it alive after the cron returns. */
export async function fetchAllCompanyJobs(
  companies: ATSCompanyRow[],
  deadline: number,
  hardCutoffAt: number,
  batchSize = taskBatchSize(),
): Promise<FetchAllCompanyJobsResult> {
  const allJobs: RawJob[] = [];
  const sourceHealth: CronRunResult["source_health"] = {};
  const errors: string[] = [];
  const warnings: string[] = [];
  const controller = new AbortController();
  const selectedTasks = sortAndRotateTasks(buildScheduledTasks(companies)).slice(0, batchSize);
  const startedTaskKeys = new Set<string>();

  function recordResult(task: ScheduledFetchTask, result: FetchTaskResult): void {
    const healthKey = `${result.company}:${result.mode}`;
    if (result.error) {
      errors.push(`${result.company} (${result.mode}): ${result.error}`);
      sourceHealth[healthKey] = { company: result.company, fetched: 0, errors: 1 };
    } else {
      allJobs.push(...result.jobs);
      sourceHealth[healthKey] = { company: result.company, fetched: result.jobs.length, errors: 0 };
    }
    for (const warning of result.warnings ?? [])
      warnings.push(`${result.company} (${result.mode}): ${warning}`);
  }

  const workableTasks: Array<() => Promise<FetchTaskResult>> = [];
  const otherTasks: Array<() => Promise<FetchTaskResult>> = [];
  for (const task of selectedTasks) {
    const fetchTask = makeFetchTask(
      task,
      deadline,
      controller.signal,
      (startedTask) => startedTaskKeys.add(`${startedTask.row.id}:${startedTask.mode}`),
      recordResult,
    );
    (task.row.ats === "workable" ? workableTasks : otherTasks).push(fetchTask);
  }

  const dispatchComplete = Promise.all([
    withConcurrencyLimit(workableTasks, WORKABLE_CONCURRENCY_LIMIT),
    withConcurrencyLimit(otherTasks, CONCURRENCY_LIMIT),
  ]);
  const remaining = Math.max(0, hardCutoffAt - Date.now());
  let cutoffTimer: ReturnType<typeof setTimeout> | undefined;
  const cutoff = new Promise<"cutoff">((resolve) => {
    cutoffTimer = setTimeout(() => resolve("cutoff"), remaining);
  });
  const outcome = await Promise.race([dispatchComplete.then(() => "complete" as const), cutoff]);
  if (cutoffTimer) clearTimeout(cutoffTimer);
  if (outcome === "cutoff") {
    console.warn("[cron] fetch hard cutoff reached; aborting remaining ATS requests");
    controller.abort();
    await dispatchComplete;
  }
  recordDispatchCursor(selectedTasks, startedTaskKeys);
  return { allJobs, sourceHealth, errors, warnings };
}
