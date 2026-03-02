// src/scripts/cron.ts
// Entry point for: pnpm run cron:now
// Runs the full scan and prints a summary.

import { config } from "dotenv";
import path from "path";

// Explicitly load .env.local
config({ path: path.resolve(process.cwd(), ".env.local") });

import { runAllSources } from "../lib/runner";

(async () => {
  try {
    const log = await runAllSources();
    console.log("\n── Run summary ──────────────────────────────────────");
    console.log(`  New jobs:    ${log.newJobs}`);
    console.log(`  Total jobs:  ${log.totalJobs}`);
    console.log(`  Duration:    ${(log.durationMs / 1000).toFixed(1)}s`);
    console.log(`  Sources:     ${JSON.stringify(log.sources)}`);
    if (log.errors.length) {
      console.warn(`  Errors (${log.errors.length}):`);
      log.errors.forEach((e) => console.warn(`    • ${e}`));
    }
    console.log("─────────────────────────────────────────────────────\n");
    process.exit(0);
  } catch (err) {
    console.error("[cron] Fatal error:", err);
    process.exit(1);
  }
})();
