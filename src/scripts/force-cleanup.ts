// src/scripts/force-cleanup.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readStore, writeStore, mergeJobs } from "../lib/storage";

async function main() {
  console.log("🧹 Starting force database cleanup...");
  const store = await readStore();
  const initialCount = store.jobs.length;

  console.log(`Initial jobs: ${initialCount}`);

  // Re-run merge with empty incoming to trigger the new filter logic on existing items
  const { store: updated } = mergeJobs(store, []);

  const finalCount = updated.jobs.length;
  console.log(`Final jobs: ${finalCount}`);

  if (initialCount !== finalCount) {
    const removed = store.jobs.filter((j) => !updated.jobs.some((u) => u.id === j.id));
    console.log("Removed jobs:");
    removed.forEach((j) => console.log(`  - ${j.title} (${j.mode})`));

    await writeStore(updated);
    console.log("✅ Database updated.");
  } else {
    console.log("✨ No jobs needed removal.");
  }
}

main();
