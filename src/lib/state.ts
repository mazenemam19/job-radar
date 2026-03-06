// src/lib/state.ts
import { supabase } from "./supabase";
import fs from "fs";
import path from "path";
import type { ScanState } from "@/types";

const DB_KEY = "scan-state.json";
const LOCAL_STATE_PATH = path.resolve(process.cwd(), "data/scan-state.json");

let currentProcessState: ScanState | null = null;

export async function readState(): Promise<ScanState> {
  if (currentProcessState) return currentProcessState;

  if (!process.env.VERCEL) {
    try {
      if (fs.existsSync(LOCAL_STATE_PATH)) {
        currentProcessState = JSON.parse(fs.readFileSync(LOCAL_STATE_PATH, "utf-8"));
        return currentProcessState!;
      }
    } catch { /* ignore */ }
  }

  try {
    const { data, error } = await supabase
      .from("storage")
      .select("data")
      .eq("key", DB_KEY)
      .single();

    if (!error && data) {
      currentProcessState = data.data as ScanState;
      return currentProcessState;
    }
  } catch { /* ignore */ }

  currentProcessState = { workableOffsets: {} };
  return currentProcessState;
}

export async function updateState(updates: Partial<ScanState>) {
  const state = await readState();
  Object.assign(state, updates);
}

export async function finalizeBatchState() {
  if (!currentProcessState) return;

  try {
    const content = {
      ...currentProcessState,
      lastUpdated: new Date().toISOString(),
    };

    if (!process.env.VERCEL) {
      const dir = path.dirname(LOCAL_STATE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(LOCAL_STATE_PATH, JSON.stringify(content, null, 2));
    }

    await supabase.from("storage").upsert({ key: DB_KEY, data: content });
  } catch (e) {
    console.error("[state] Failed to save state:", e);
  }
}
