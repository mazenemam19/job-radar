// src/lib/runner.ts
import { readStore, writeStore, mergeJobs, appendCronLog } from "./storage";
import { fetchCompanyJobs } from "./sources/companies";
import { fetchLocalJobs } from "./sources/local-companies";
import { sendJobAlert } from "./email";
import type { CronLog } from "./types";

export async function runAllSources(): Promise<CronLog> {
  console.log("[runner] ── Scan start ───────────────────────────────────────");
  const t0 = Date.now();
  const store = readStore();
  const existingIds = new Set(store.jobs.map(j => j.id));

  const errors: string[] = [];
  let visaJobs: Awaited<ReturnType<typeof fetchCompanyJobs>> = [];
  let localJobs: Awaited<ReturnType<typeof fetchLocalJobs>> = [];

  // Run both pipelines in parallel
  const [visaResult, localResult] = await Promise.allSettled([
    fetchCompanyJobs(),
    fetchLocalJobs(),
  ]);

  if (visaResult.status === "fulfilled") visaJobs = visaResult.value;
  else { errors.push(`visa pipeline: ${visaResult.reason}`); console.error("[runner] visa pipeline failed:", visaResult.reason); }

  if (localResult.status === "fulfilled") localJobs = localResult.value;
  else { errors.push(`local pipeline: ${localResult.reason}`); console.error("[runner] local pipeline failed:", localResult.reason); }

  const fetched = [...visaJobs, ...localJobs];
  const { store: updated, added } = mergeJobs(store, fetched);

  // Email alert only for brand-new visa-mode jobs (local jobs are close by — no email needed)
  const brandNewVisa = added.filter(j => !existingIds.has(j.id) && j.mode === "visa");
  if (brandNewVisa.length) {
    try { await sendJobAlert(brandNewVisa); }
    catch (err) { errors.push(`email: ${err}`); console.error("[runner] email failed:", err); }
  }

  const durationMs = Date.now() - t0;
  const log: CronLog = {
    runAt: new Date().toISOString(),
    newJobs: added.length,
    totalJobs: updated.jobs.length,
    sources: { visa: visaJobs.length, local: localJobs.length },
    durationMs,
    errors,
  };

  writeStore(appendCronLog(updated, log));
  console.log(`[runner] Done in ${(durationMs / 1000).toFixed(1)}s — ${added.length} new, ${updated.jobs.length} total`);
  return log;
}