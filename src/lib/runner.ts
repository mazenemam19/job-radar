import { readStore, writeStore, mergeJobs, appendCronLog } from "./storage";
import { fetchCompanyJobs } from "./sources/companies";
import { fetchLocalJobs } from "./sources/local-companies";
import { fetchGlobalJobs } from "./sources/global-companies";
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
  let globalJobs: Awaited<ReturnType<typeof fetchGlobalJobs>> = [];

  const [visaResult, localResult, globalResult] = await Promise.allSettled([
    fetchCompanyJobs(),
    fetchLocalJobs(),
    fetchGlobalJobs(),
  ]);

  if (visaResult.status === "fulfilled") visaJobs = visaResult.value;
  else { errors.push(`visa pipeline: ${visaResult.reason}`); console.error("[runner] visa pipeline failed:", visaResult.reason); }

  if (localResult.status === "fulfilled") localJobs = localResult.value;
  else { errors.push(`local pipeline: ${localResult.reason}`); console.error("[runner] local pipeline failed:", localResult.reason); }

  if (globalResult.status === "fulfilled") globalJobs = globalResult.value;
  else { errors.push(`global pipeline: ${globalResult.reason}`); console.error("[runner] global pipeline failed:", globalResult.reason); }

  const fetched = [...visaJobs, ...localJobs, ...globalJobs];
  const { store: updated, added } = mergeJobs(store, fetched);

  // Email alert only for brand-new visa-mode jobs
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
    sources: { visa: visaJobs.length, local: localJobs.length, global: globalJobs.length },
    durationMs,
    errors,
  };

  writeStore(appendCronLog(updated, log));
  console.log(`[runner] Done in ${(durationMs / 1000).toFixed(1)}s — ${added.length} new, ${updated.jobs.length} total`);
  return log;
}