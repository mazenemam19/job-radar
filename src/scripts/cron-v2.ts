// src/scripts/cron-v2.ts
// Entry point for: pnpm run cron:v2
// Runs the full v2 multi-tenant scrape scan.

import { config } from "dotenv";
import path from "path";

// Load local environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });

import { runCronJob } from "../lib/v2/runner";

(async () => {
  try {
    console.log("[cron-v2] Starting global scrape scan...");
    const log = await runCronJob("manual");
    console.log("\n── V2 Run summary ───────────────────────────────────");
    console.log(`  Total fetched:  ${log.total_fetched}`);
    console.log(`  Duration:       ${(log.duration_ms / 1000).toFixed(1)}s`);
    if (log.errors.length) {
      console.warn(`  Errors (${log.errors.length}):`);
      log.errors.forEach((e) => console.warn(`    • ${e}`));
    } else {
      console.log("  Errors:         None");
    }
    console.log("─────────────────────────────────────────────────────\n");
    process.exit(0);
  } catch (err) {
    console.error("[cron-v2] Fatal error:", err);
    process.exit(1);
  }
})();
