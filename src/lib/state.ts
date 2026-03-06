// src/lib/state.ts
import { supabase } from "./supabase";
import fs from "fs";
import path from "path";

const DB_KEY = "scan-state.json";
const LOCAL_STATE_PATH = path.resolve(process.cwd(), "data/scan-state.json");

/**
 * Saves the final state to both local disk and Supabase.
 * Note: We currently scan all companies every run, so offsets are no longer used,
 * but we preserve the state file structure for future persistence needs.
 */
export async function finalizeBatchState() {
  const content = { workableOffsets: {} };

  try {
    // Save to local disk (skip if in Vercel)
    if (!process.env.VERCEL) {
      const dir = path.dirname(LOCAL_STATE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_STATE_PATH, JSON.stringify(content, null, 2));
    }

    // Save to Supabase
    await supabase.from("storage").upsert({ key: DB_KEY, data: content });
  } catch (e) {
    console.error("[state] Failed to save state:", e);
  }
}
