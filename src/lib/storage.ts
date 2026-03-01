// src/lib/storage.ts
import { put, head } from "@vercel/blob";
import { Job, JobStore, CronLog } from "./types";

const BLOB_KEY = "jobs-store.json";
const MAX_JOBS = 500;
const MAX_JOB_AGE_DAYS = 7;

function emptyStore(): JobStore {
  return { jobs: [], lastUpdated: new Date().toISOString(), cronLogs: [] };
}

// Read from Vercel Blob
export async function readStore(): Promise<JobStore> {
  try {
    // Check if blob exists
    const h = await head(BLOB_KEY).catch(() => null);
    if (!h) return emptyStore();

    const res = await fetch(h.url);
    if (!res.ok) return emptyStore();

    const store = (await res.json()) as JobStore;

    // ── Auto-expire old jobs on every read ──────────────────────────────────
    const cutoff = Date.now() - MAX_JOB_AGE_DAYS * 864e5;
    store.jobs = store.jobs.filter(j => {
      const ms = Date.parse(j.postedAt);
      return isNaN(ms) || ms >= cutoff;
    });

    return store;
  } catch {
    return emptyStore();
  }
}

// Write to Vercel Blob
export async function writeStore(store: JobStore): Promise<void> {
  await put(BLOB_KEY, JSON.stringify(store, null, 2), {
    access: "public",
    addRandomSuffix: false,
  });
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
