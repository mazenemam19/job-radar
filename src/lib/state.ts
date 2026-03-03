// src/lib/state.ts
import { put, list } from "@vercel/blob";
import fs from "fs";
import path from "path";
import type { ScanState } from "./types";

const STATE_BLOB_KEY = "scan-state.json";
const LOCAL_STATE_PATH = path.resolve(process.cwd(), "data/scan-state.json");

// Global in-memory state to track updates during a single process run
let currentProcessState: ScanState | null = null;

async function readState(): Promise<ScanState> {
  if (currentProcessState) return currentProcessState;

  // 1. Try local disk first (for local dev/back-to-back runs)
  try {
    if (fs.existsSync(LOCAL_STATE_PATH)) {
      currentProcessState = JSON.parse(fs.readFileSync(LOCAL_STATE_PATH, "utf-8"));
      console.log(
        `[state] Loaded from local disk. local-workable: ${currentProcessState?.workableOffsets["local-workable"] || 0}`,
      );
      return currentProcessState!;
    }
  } catch {
    /* ignore local error */
  }

  // 2. Try Vercel Blob (for production/cloud)
  try {
    const { blobs } = await list();
    const entry = blobs.find((b) => b.pathname === STATE_BLOB_KEY);
    if (!entry) {
      currentProcessState = { workableOffsets: {} };
      return currentProcessState;
    }

    const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const res = await fetch(`${entry.url}?t=${cacheBuster}`);
    if (!res.ok) return { workableOffsets: {} };

    currentProcessState = (await res.json()) as ScanState;
    console.log(
      `[state] Loaded from cloud blob. local-workable: ${currentProcessState.workableOffsets["local-workable"] || 0}`,
    );
    return currentProcessState;
  } catch {
    return { workableOffsets: {} };
  }
}

/**
 * Saves the final state to both local disk and Vercel Blob.
 */
export async function finalizeBatchState() {
  if (!currentProcessState) return;

  try {
    const content = JSON.stringify(currentProcessState, null, 2);

    // Save to local disk
    const dir = path.dirname(LOCAL_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_STATE_PATH, content);

    // Save to Vercel Blob
    console.log("[state] Finalizing and saving all offsets to cloud...");
    await put(STATE_BLOB_KEY, content, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    console.log("[state] Save successful.");
  } catch (e) {
    console.error("[state] Failed to save state:", e);
  }
}

export async function getNextBatch<T>(items: T[], batchSize: number, key: string): Promise<T[]> {
  if (items.length === 0) return [];

  const state = await readState();
  const currentOffset = state.workableOffsets[key] || 0;

  const start = currentOffset >= items.length ? 0 : currentOffset;
  const batch = items.slice(start, start + batchSize);

  console.log(
    `[state] Batching: ${key} | Offset ${start} -> ${Math.min(start + batchSize, items.length)}`,
  );

  if (batch.length < batchSize && items.length > batchSize) {
    const remaining = batchSize - batch.length;
    batch.push(...items.slice(0, remaining));
    state.workableOffsets[key] = remaining;
  } else {
    state.workableOffsets[key] = (start + batchSize) % items.length;
  }

  return batch;
}
