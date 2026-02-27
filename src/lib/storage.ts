// src/lib/storage.ts
import path from "path";
import fs from "fs";
import { Job, JobStore, CronLog } from "./types";

const STORE_PATH = path.resolve(process.cwd(), "data/jobs.json");
const MAX_JOBS = 500;

/**
 * Jobs older than this are auto-removed from the store on every read.
 * Since we only scrape jobs ≤7 days old (AGE_CAP_DAYS in ats-utils),
 * this ensures stale jobs that were added last week get pruned automatically.
 *
 * How expiry works:
 * 1. processJobs() in ats-utils only admits jobs posted ≤7 days ago (by postedAt)
 * 2. mergeJobs() adds NEW jobs to the store (deduplicates by id)
 * 3. readStore() filters out any stored job where postedAt is now >7 days ago
 *
 * Result: on every cron run + every dashboard load, stale jobs are silently dropped.
 * No manual cleanup needed.
 */
const MAX_JOB_AGE_DAYS = 7;

function emptyStore(): JobStore {
  return { jobs: [], lastUpdated: new Date().toISOString(), cronLogs: [] };
}

export function readStore(): JobStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return emptyStore();
    const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as JobStore;

    // ── Auto-expire old jobs on every read ──────────────────────────────────
    // postedAt is the job's original posting date (or fetchedAt if API had none).
    // Any job older than MAX_JOB_AGE_DAYS is removed silently.
    const cutoff = Date.now() - MAX_JOB_AGE_DAYS * 864e5;
    store.jobs = store.jobs.filter(j => {
      const ms = Date.parse(j.postedAt);
      return isNaN(ms) || ms >= cutoff;  // keep if date unparseable (safety) or still fresh
    });

    return store;
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
 * - Deduplicates by id (existing job keeps its original postedAt — no date drift)
 * - Sorts by totalScore descending
 * - Caps at MAX_JOBS
 */
export function mergeJobs(store: JobStore, incoming: Job[]): { store: JobStore; added: Job[] } {
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
  return { ...store, cronLogs: [log, ...store.cronLogs].slice(0, 20) };
}
