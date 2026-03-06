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
const RAW_BLOB_KEY = "raw-market-store.json";
const MAX_JOBS = 500;
const MAX_JOB_AGE_DAYS = 7;
const MAX_RAW_AGE_DAYS = 30;

function emptyStore(): JobStore {
  return { jobs: [], lastUpdated: new Date().toISOString(), cronLogs: [] };
}

// ── APPROVED STORE ( survivors of all filters ) ─────────────────────────────

export async function readStore(): Promise<JobStore> {
  try {
    const { blobs } = await list();
    const entry = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!entry) return emptyStore();

    const res = await fetch(`${entry.url}?t=${Date.now()}`);
    if (!res.ok) return emptyStore();

    const store = (await res.json()) as JobStore;

    // Auto-expire old jobs
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

export async function writeStore(store: JobStore): Promise<void> {
  await put(BLOB_KEY, JSON.stringify(store, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ── RAW MARKET STORE ( all fetched data before filtering ) ───────────────────

export async function readRawStore(): Promise<Job[]> {
  try {
    const { blobs } = await list();
    const entry = blobs.find((b) => b.pathname === RAW_BLOB_KEY);
    if (!entry) return [];

    const res = await fetch(`${entry.url}?t=${Date.now()}`);
    if (!res.ok) return [];

    const jobs = (await res.json()) as Job[];

    // Auto-expire raw data older than 30 days
    const cutoff = Date.now() - MAX_RAW_AGE_DAYS * 864e5;
    return jobs.filter((j) => {
      const ms = Date.parse(j.postedAt);
      return !isNaN(ms) && ms >= cutoff;
    });
  } catch {
    return [];
  }
}

export async function writeRawStore(jobs: Job[]): Promise<void> {
  await put(RAW_BLOB_KEY, JSON.stringify(jobs, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ── MERGE LOGIC ─────────────────────────────────────────────────────────────

export function mergeJobs(store: JobStore, incoming: Job[]): { store: JobStore; added: Job[] } {
  const cutoff = Date.now() - MAX_JOB_AGE_DAYS * 864e5;
  const existingIds = new Set(store.jobs.map((j) => j.id));

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
