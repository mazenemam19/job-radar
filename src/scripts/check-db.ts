// src/scripts/check-db.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { supabase } from "../lib/supabase";

async function main() {
  const { data, error } = await supabase.from("storage").select("key, data");

  if (error) {
    console.error("Error reading database:", error);
    return;
  }

  console.log("Database entries in 'storage' table:");
  data.forEach((row) => {
    const dataSize = JSON.stringify(row.data).length;
    let itemCount = 0;
    if (row.key === "jobs-store.json") {
      itemCount = row.data?.jobs?.length || 0;
    } else if (row.key === "raw-market-store.json") {
      itemCount = row.data?.length || 0;
    } else if (row.key === "health-store.json") {
      itemCount = Object.keys(row.data || {}).length;
    } else if (row.key === "scan-state.json") {
      itemCount = 1;
    }

    console.log(
      `- Key: ${row.key.padEnd(25)} | Items: ${String(itemCount).padStart(5)} | Size: ${dataSize} bytes`,
    );
  });
}

main();
