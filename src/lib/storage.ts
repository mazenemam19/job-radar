import fs from "fs";
import path from "path";
import { Job, StorageData } from "@/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "jobs.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDb(): StorageData {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    return { jobs: [], lastFetchedAt: null, totalFetched: 0 };
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    return JSON.parse(raw) as StorageData;
  } catch {
    return { jobs: [], lastFetchedAt: null, totalFetched: 0 };
  }
}

function writeDb(data: StorageData): void {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getJobs(): Job[] {
  return readDb().jobs;
}

export function getMeta(): Pick<StorageData, "lastFetchedAt" | "totalFetched"> {
  const { lastFetchedAt, totalFetched } = readDb();
  return { lastFetchedAt, totalFetched };
}

export function upsertJobs(incoming: Job[]): { added: number; updated: number; skipped: number } {
  const db = readDb();
  const existing = new Map(db.jobs.map((j) => [j.id, j]));

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const job of incoming) {
    const prev = existing.get(job.id);
    if (!prev) {
      existing.set(job.id, job);
      added++;
    } else if (prev.totalScore !== job.totalScore || prev.matchedSkills.length !== job.matchedSkills.length) {
      existing.set(job.id, { ...job, fetchedAt: new Date().toISOString() });
      updated++;
    } else {
      skipped++;
    }
  }

  // Sort by totalScore desc, then postedAt desc
  const sorted = Array.from(existing.values()).sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });

  // Keep max 500 jobs to avoid the file growing unbounded
  const trimmed = sorted.slice(0, 500);

  writeDb({
    jobs: trimmed,
    lastFetchedAt: new Date().toISOString(),
    totalFetched: db.totalFetched + added,
  });

  return { added, updated, skipped };
}
