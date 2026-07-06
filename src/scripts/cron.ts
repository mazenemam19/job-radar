// src/scripts/cron.ts
// Entry point for: pnpm run cron
// Runs the full multi-tenant scrape scan.

import { config } from "dotenv";
import path from "path";

// Load local environment variables
config({ path: path.resolve(process.cwd(), ".env.local") });

import { runCronJob } from "../lib/runner";

(async () => {
  try {
    console.log("[cron] Starting global scrape scan...");
    const log = await runCronJob("manual");
    console.log("\n── Run summary ───────────────────────────────────");
    console.log(`  Total fetched:  ${log.total_fetched}`);
    console.log(`  Duration:       ${(log.duration_ms / 1000).toFixed(1)}s`);
    if (log.errors.length) {
      console.warn(`  Errors (${log.errors.length}):`);
      log.errors.forEach((e) => console.warn(`    • ${e}`));
    } else {
      console.log("  Errors:         None");
    }
    if (log.warnings.length) {
      console.warn(`  Warnings (${log.warnings.length}):`);
      log.warnings.forEach((w) => console.warn(`    ⚠ ${w}`));
    } else {
      console.log("  Warnings:       None");
    }
    console.log("─────────────────────────────────────────────────────\n");
    process.exit(0);
  } catch (err) {
    console.error("[cron] Fatal error:", err);
    process.exit(1);
  }
})();
