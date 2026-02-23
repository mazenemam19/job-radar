import fs from "fs";
import path from "path";
import { Job, JobStore } from "./types";

const DATA_PATH = path.join(process.cwd(), "data", "jobs.json");
const MAX_JOBS = 500;

function ensureDataFile(): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_PATH)) {
    const empty: JobStore = { jobs: [], lastUpdated: new Date().toISOString() };
    fs.writeFileSync(DATA_PATH, JSON.stringify(empty, null, 2));
  }
}

export function readStore(): JobStore {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw) as JobStore;
  } catch {
    return { jobs: [], lastUpdated: new Date().toISOString() };
  }
}

export function writeStore(store: JobStore): void {
  ensureDataFile();
  // Sort by totalScore desc, trim to MAX_JOBS
  store.jobs.sort((a, b) => b.totalScore - a.totalScore);
  if (store.jobs.length > MAX_JOBS) {
    store.jobs = store.jobs.slice(0, MAX_JOBS);
  }
  store.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

export function mergeJobs(existingStore: JobStore, newJobs: Job[]): { store: JobStore; added: number; skipped: number } {
  const existingIds = new Set(existingStore.jobs.map((j) => j.id));
  let added = 0;
  let skipped = 0;

  for (const job of newJobs) {
    if (existingIds.has(job.id)) {
      skipped++;
    } else {
      existingStore.jobs.push(job);
      existingIds.add(job.id);
      added++;
    }
  }

  return { store: existingStore, added, skipped };
}
