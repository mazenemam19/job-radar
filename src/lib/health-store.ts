// src/lib/health-store.ts
import { supabase } from "./supabase";
import { HealthStore, HealthStat } from "./types";

const DB_KEY = "health-store.json";

let healthStoreCache: HealthStore | null = null;

// Read from Supabase
export async function readHealthStore(): Promise<HealthStore> {
  if (healthStoreCache) return healthStoreCache;
  try {
    const { data, error } = await supabase
      .from("storage")
      .select("data")
      .eq("key", DB_KEY)
      .single();

    if (error || !data) {
      healthStoreCache = {};
      return {};
    }

    const store = data.data as HealthStore;
    healthStoreCache = store;
    return store;
  } catch {
    healthStoreCache = {};
    return {};
  }
}

// Write to Supabase
export async function writeHealthStore(store: HealthStore): Promise<void> {
  healthStoreCache = store; // Keep cache in sync
  await supabase.from("storage").upsert({ key: DB_KEY, data: store });
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
