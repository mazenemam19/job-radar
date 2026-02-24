// src/lib/storage.ts
import path from "path";
import fs from "fs";
import { Job, JobStore, CronLog } from "./types";

const STORE_PATH = path.resolve(process.cwd(), "data/jobs.json");
const MAX_JOBS = 500;

function emptyStore(): JobStore {
  return { jobs: [], lastUpdated: new Date().toISOString(), cronLogs: [] };
}

export function readStore(): JobStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return emptyStore();
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as JobStore;
  } catch {
    return emptyStore();
  }
}

export function writeStore(store: JobStore): void {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Merge new jobs into store.
 * - Deduplicates by id
 * - Sorts by totalScore descending
 * - Caps at MAX_JOBS (500) — removes lowest-scoring overflow
 * Returns the updated store AND the slice of actually-added jobs.
 */
export function mergeJobs(
  store: JobStore,
  incoming: Job[],
): { store: JobStore; added: Job[] } {
  const existingIds = new Set(store.jobs.map(j => j.id));
  const added = incoming.filter(j => !existingIds.has(j.id));

  const merged = [...store.jobs, ...added]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, MAX_JOBS);

  return {
    store: { ...store, jobs: merged, lastUpdated: new Date().toISOString() },
    added,
  };
}

export function appendCronLog(store: JobStore, log: CronLog): JobStore {
  return {
    ...store,
    cronLogs: [log, ...store.cronLogs].slice(0, 20), // keep last 20 runs
  };
}
