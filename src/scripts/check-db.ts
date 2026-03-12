// src/scripts/check-db.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabase } from "../lib/supabase";
import { Job } from "../types";

interface StorageRow {
  key: string;
  data: unknown;
}

async function main() {
  const { data, error } = await supabase
    .from("storage")
    .select("key, data");

  if (error) {
    console.error("Error reading database:", error);
    return;
  }

  console.log("Database entries in 'storage' table:");
  (data as StorageRow[]).forEach((row) => {
    if (row.key === "jobs-store.json") {
      const jobs = (row.data as { jobs: Job[] })?.jobs || [];
      console.log(`- Key: jobs-store.json | Items: ${jobs.length}`);
      jobs.forEach((j) => {
          console.log(`  - Title: ${j.title.padEnd(45)} | Mode: ${j.mode.padEnd(10)} | Location: ${j.location}`);
      });
    }
  });
}

main();
