// src/lib/health-store.ts
import { put, list } from "@vercel/blob";
import { HealthStore, HealthStat } from "./types";

const BLOB_KEY = "health-store.json";

let healthStoreCache: HealthStore | null = null;

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
 * Updates lifetime stats for multiple sources at once.
 * This is much more efficient than updating one by one.
 */
export async function trackMultipleApiCalls(
  results: Record<string, boolean>,
): Promise<HealthStore> {
  const store = await readHealthStore();

  for (const [sourceName, success] of Object.entries(results)) {
    if (!store[sourceName]) {
      store[sourceName] = { success: 0, total: 0 };
    }
    store[sourceName].total += 1;
    if (success) {
      store[sourceName].success += 1;
    }
  }

  await writeHealthStore(store);
  return store;
}

/**
 * Just retrieves the current stats without incrementing.
 */
export async function getHealthStat(sourceName: string): Promise<HealthStat> {
  const store = await readHealthStore();
  return store[sourceName] || { success: 0, total: 0 };
}
