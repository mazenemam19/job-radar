// src/lib/runner.ts
import { readStore, writeStore, mergeJobs, appendCronLog } from "./storage";
import { fetchCompanyJobs } from "./sources/companies";
import { sendJobAlert } from "./email";
import type { CronLog } from "./types";

export async function runAllSources(): Promise<CronLog> {
  console.log("[runner] ── Starting scan ──────────────────────────────────");
  const t0 = Date.now();

  const store = readStore();

  // Snapshot BEFORE merge so email only fires for brand-new IDs
  const existingIds = new Set(store.jobs.map(j => j.id));

  const errors: string[] = [];
  let fetched: Awaited<ReturnType<typeof fetchCompanyJobs>> = [];

  try {
    fetched = await fetchCompanyJobs();
  } catch (err) {
    const msg = `fetchCompanyJobs threw: ${err}`;
    errors.push(msg);
    console.error("[runner]", msg);
  }

  const { store: updated, added } = mergeJobs(store, fetched);

  // Email: only jobs that weren't in the store before this run
  const brandNew = added.filter(j => !existingIds.has(j.id));
  if (brandNew.length) {
    try {
      await sendJobAlert(brandNew);
    } catch (err) {
      errors.push(`email: ${err}`);
      console.error("[runner] email failed:", err);
    }
  }

  const durationMs = Date.now() - t0;

  const log: CronLog = {
    runAt: new Date().toISOString(),
    newJobs: added.length,
    totalJobs: updated.jobs.length,
    sources: { company: fetched.length },
    durationMs,
    errors,
  };

  writeStore(appendCronLog(updated, log));

  console.log(
    `[runner] Done in ${(durationMs / 1000).toFixed(1)}s — ` +
    `${added.length} new, ${updated.jobs.length} total, ${errors.length} errors`,
  );

  return log;
}
