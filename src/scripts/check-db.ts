// src/scripts/check-db.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabase } from "../lib/supabase";

async function main() {
  const { data, error } = await supabase
    .from("storage")
    .select("key, data");

  if (error) {
    console.error("Error reading database:", error);
    return;
  }

  console.log("Database entries in 'storage' table:");
  data.forEach((row: any) => {
    const dataSize = JSON.stringify(row.data).length;
    let itemCount = 0;
    if (row.key === "jobs-store.json") {
      itemCount = row.data?.jobs?.length || 0;
      console.log(`- Key: ${row.key.padEnd(25)} | Items: ${String(itemCount).padStart(5)} | Size: ${dataSize} bytes`);
      
      // Sample job seniority
      if (itemCount > 0) {
          console.log("  Sample Seniority Titles:");
          row.data.jobs.slice(0, 10).forEach((j: any) => {
              console.log(`    - Title: ${j.title.padEnd(45)} | Mode: ${j.mode.padEnd(10)} | ID: ${j.id}`);
          });
      }
    } else {
        if (row.key === "raw-market-store.json") itemCount = row.data?.length || 0;
        console.log(`- Key: ${row.key.padEnd(25)} | Items: ${String(itemCount).padStart(5)} | Size: ${dataSize} bytes`);
    }
  });
}

main();
