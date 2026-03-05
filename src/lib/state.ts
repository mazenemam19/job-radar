// src/lib/state.ts
import { put } from "@vercel/blob";
import fs from "fs";
import path from "path";

const STATE_BLOB_KEY = "scan-state.json";
const LOCAL_STATE_PATH = path.resolve(process.cwd(), "data/scan-state.json");

/**
 * Saves the final state to both local disk and Vercel Blob.
 * Note: We currently scan all companies every run, so offsets are no longer used,
 * but we preserve the state file structure for future persistence needs.
 */
export async function finalizeBatchState() {
  const content = JSON.stringify({ workableOffsets: {} }, null, 2);

  try {
    // Save to local disk (skip if in Vercel)
    if (!process.env.VERCEL) {
      const dir = path.dirname(LOCAL_STATE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_STATE_PATH, content);
    }

    // Save to Vercel Blob
    await put(STATE_BLOB_KEY, content, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("[state] Failed to save state:", e);
  }
}
