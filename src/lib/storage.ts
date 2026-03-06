// src/lib/storage.ts
import { supabase } from "./supabase";
import { Job, JobStore, CronLog } from "./types";
import {
  isClearlyNonFrontend,
  isTooSeniorOrTooJunior,
  isGenericTitleButBackendRole,
  requiresCitizenshipOrClearance,
} from "./scoring";

const DB_KEY = "jobs-store.json";
const DB_RAW_KEY = "raw-market-store.json";
const MAX_JOBS = 500;
const MAX_JOB_AGE_DAYS = 7;
const MAX_RAW_AGE_DAYS = 30;

function emptyStore(): JobStore {
  return { jobs: [], lastUpdated: new Date().toISOString(), cronLogs: [] };
}

// ── APPROVED STORE ( survivors of all filters ) ─────────────────────────────

export async function readStore(): Promise<JobStore> {
  try {
    const { data, error } = await supabase
      .from("storage")
      .select("data")
      .eq("key", DB_KEY)
      .single();

    if (error || !data) return emptyStore();

    const store = data.data as JobStore;

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
  await supabase.from("storage").upsert({ key: DB_KEY, data: store });
}

// ── RAW MARKET STORE ( all fetched data before filtering ) ───────────────────

export async function readRawStore(): Promise<Job[]> {
  try {
    const { data, error } = await supabase
      .from("storage")
      .select("data")
      .eq("key", DB_RAW_KEY)
      .single();

    if (error || !data) return [];

    const jobs = data.data as Job[];

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
  await supabase.from("storage").upsert({ key: DB_RAW_KEY, data: jobs });
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
