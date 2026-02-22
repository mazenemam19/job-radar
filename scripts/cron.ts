#!/usr/bin/env ts-node
/**
 * Standalone cron runner.
 *
 * Usage:
 *   npm run cron           → start scheduler (runs every 6 hours)
 *   npm run cron:now       → fetch jobs immediately, then exit
 *
 * Or schedule via system cron (no Node process kept alive):
 *   0 * /6 * * * cd /path/to/job-radar && npm run cron:now >> logs/cron.log 2>&1
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

import cron from "node-cron";
import { fetchAllJobs } from "../src/lib/fetcher";
import { upsertJobs } from "../src/lib/storage";
import { sendNewJobsNotification } from "../src/lib/mailer";

const runNow = process.argv.includes("--run-now");

async function runFetch() {
  const startedAt = new Date();
  console.log(`\n${"─".repeat(60)}`);
  console.log(`⏰  Job Radar fetch started at ${startedAt.toLocaleString()}`);
  console.log("─".repeat(60));

  try {
    const jobs = await fetchAllJobs();

    if (jobs.length === 0) {
      console.log("ℹ️  No jobs returned from any source.");
      return;
    }

    const { added, updated, skipped } = upsertJobs(jobs);
    console.log(`\n✅  Done — added: ${added}, updated: ${updated}, skipped: ${skipped}`);

    if (added > 0) {
      const topNew = jobs
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, Math.min(added, 20));
      await sendNewJobsNotification(topNew);
    } else {
      console.log("📭  No new jobs — skipping email notification");
    }
  } catch (err) {
    console.error("❌  Fetch failed:", err);
  }

  const durationMs = Date.now() - startedAt.getTime();
  console.log(`⏱️  Duration: ${(durationMs / 1000).toFixed(1)}s\n`);
}

if (runNow) {
  runFetch().then(() => process.exit(0));
} else {
  // Every 6 hours: 0 */6 * * *
  const schedule = process.env.CRON_SCHEDULE ?? "0 */6 * * *";
  console.log(`🕐  Scheduler started. Running on schedule: "${schedule}"`);
  console.log("   Press Ctrl+C to stop.\n");

  // Run immediately on start, then follow schedule
  runFetch();

  cron.schedule(schedule, () => {
    runFetch();
  });
}
