// src/lib/health-store.ts
import { put, list } from "@vercel/blob";
import { HealthStore, HealthStat } from "./types";

const BLOB_KEY = "health-store.json";

let healthStoreCache: HealthStore | null = null;
let updateQueue: Promise<unknown> = Promise.resolve();

// Read from Vercel Blob
export async function readHealthStore(): Promise<HealthStore> {
  if (healthStoreCache) return healthStoreCache;
  try {
    const { blobs } = await list();
    const entry = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!entry) {
      healthStoreCache = {};
      return {};
    }

    const res = await fetch(`${entry.url}?t=${Date.now()}`);
    if (!res.ok) {
      healthStoreCache = {};
      return {};
    }

    const store = (await res.json()) as HealthStore;
    healthStoreCache = store;
    return store;
  } catch {
    healthStoreCache = {};
    return {};
  }
}

// Write to Vercel Blob
export async function writeHealthStore(store: HealthStore): Promise<void> {
  healthStoreCache = store; // Keep cache in sync
  await put(BLOB_KEY, JSON.stringify(store, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/**
 * Tracks an API call for a given source, updating its lifetime stats.
 * Uses a sequential queue to prevent race conditions during parallel scan runs.
 */
export async function trackApiCall(sourceName: string, success: boolean): Promise<HealthStat> {
  const result = updateQueue.then(async () => {
    const store = await readHealthStore();

    // Ensure the entry exists
    if (!store[sourceName]) {
      store[sourceName] = { success: 0, total: 0 };
    }

    // Update stats
    store[sourceName].total += 1;
    if (success) {
      store[sourceName].success += 1;
    }

    await writeHealthStore(store);
    return store[sourceName];
  });

  updateQueue = result.catch(() => {});
  return result;
}

/**
 * Just retrieves the current stats without incrementing.
 */
export async function getHealthStat(sourceName: string): Promise<HealthStat> {
  const store = await readHealthStore();
  return store[sourceName] || { success: 0, total: 0 };
}
