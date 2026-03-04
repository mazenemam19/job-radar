// src/lib/storage.ts
import { put, list } from "@vercel/blob";
import { Job, JobStore, CronLog } from "./types";
import {
  isClearlyNonFrontend,
  isTooSeniorOrTooJunior,
  isGenericTitleButBackendRole,
  requiresCitizenshipOrClearance,
} from "./scoring";

const BLOB_KEY = "jobs-store.json";
const MAX_JOBS = 500;
const MAX_JOB_AGE_DAYS = 7;

function emptyStore(): JobStore {
  return { jobs: [], lastUpdated: new Date().toISOString(), cronLogs: [] };
}

// Read from Vercel Blob
export async function readStore(): Promise<JobStore> {
  try {
    const { blobs } = await list();
    const entry = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!entry) return emptyStore();

    // Add cache-busting query param to ensure we get fresh data
    const res = await fetch(`${entry.url}?t=${Date.now()}`);
    if (!res.ok) return emptyStore();

    const store = (await res.json()) as JobStore;

    // ── Auto-expire old jobs on every read ──────────────────────────────────
    const cutoff = Date.now() - MAX_JOB_AGE_DAYS * 864e5;
    store.jobs = store.jobs.filter((j) => {
      const ms = Date.parse(j.postedAt);
      return !isNaN(ms) && ms >= cutoff;
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
    allowOverwrite: true,
  });
}

/**
 * Merge new jobs into store.
 * - Deduplicates by id (existing job keeps its original postedAt — no date drift)
 * - Sorts by totalScore descending
 * - Caps at MAX_JOBS
 */
export function mergeJobs(store: JobStore, incoming: Job[]): { store: JobStore; added: Job[] } {
  const cutoff = Date.now() - MAX_JOB_AGE_DAYS * 864e5;
  const existingIds = new Set(store.jobs.map((j) => j.id));

  // Apply filters BEFORE calculating 'added' so we don't count rejected jobs as new
  const validIncoming = incoming.filter((j) => {
    const text = `${j.title} ${j.description}`;
    return (
      !isClearlyNonFrontend(j.title) &&
      !isTooSeniorOrTooJunior(j.title) &&
      !isGenericTitleButBackendRole(j.title, j.description) &&
      !requiresCitizenshipOrClearance(text)
    );
  });

  const added = validIncoming.filter((j) => {
    if (existingIds.has(j.id)) return false;
    const ms = Date.parse(j.postedAt);
    if (isNaN(ms) || ms < cutoff) return false;
    return true;
  });

  // ── Aggressive Re-filtering ──
  // We re-scan the entire merged set to ensure old jobs also respect any NEW filtering logic.
  const merged = [...store.jobs, ...added]
    .filter((j) => {
      const text = `${j.title} ${j.description}`;
      return (
        !isClearlyNonFrontend(j.title) &&
        !isTooSeniorOrTooJunior(j.title) &&
        !isGenericTitleButBackendRole(j.title, j.description) &&
        !requiresCitizenshipOrClearance(text)
      );
    })
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
