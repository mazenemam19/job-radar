import { readStore, writeStore, mergeJobs, appendCronLog } from "./storage";
import { fetchVisaJobs } from "./sources/visa-companies";
import { fetchLocalJobs } from "./sources/local-companies";
import { fetchRemoteJobs } from "./sources/remote-companies";
import { sendJobAlert } from "./email";
import {
  isClearlyNonFrontend,
  isTooSeniorOrTooJunior,
  isGenericTitleButBackendRole,
  requiresCitizenshipOrClearance,
} from "./scoring";
import { filterJobsWithGemini } from "./gemini";
import {
  setWorkableBudgetConfig,
  getWorkable429SlugsThisRun,
  markWorkableSlugsBlocked24h,
} from "./sources/ats-utils";
import { finalizeBatchState } from "./state";
import { trackMultipleApiCalls } from "./health-store";
import type { Job, CronLog, SourceHealth } from "./types";

export async function runAllSources(): Promise<CronLog> {
  const budgetArg = process.argv?.find(
    (a: string) => a.startsWith("--budget=") || a.startsWith("--budget-config="),
  );
  if (budgetArg) {
    try {
      const raw = budgetArg.split("=", 2)[1]?.replace(/^['"]|['"]$/g, "") ?? "{}";
      setWorkableBudgetConfig(JSON.parse(raw) as Record<string, number>);
    } catch {
      /* ignore */
    }
  }
  console.log("[runner] ── Scan start ───────────────────────────────────────");
  const t0 = Date.now();
  const store = await readStore();
  const existingIds = new Set(store.jobs.map((j) => j.id));

  const errors: string[] = [];
  const sourceDetails: Record<string, SourceHealth> = {};
  const healthResults: Record<string, boolean> = {};

  let visaJobs: Job[] = [];
  let localJobs: Job[] = [];
  let globalJobs: Job[] = [];

  // ── Run all pipelines in parallel ──────────────────────────────────────
  const [localResult, visaResult, remoteResult] = await Promise.allSettled([
    fetchLocalJobs(),
    fetchVisaJobs(),
    fetchRemoteJobs(),
  ]);

  if (localResult.status === "fulfilled") {
    localJobs = localResult.value.jobs;
    for (const key in localResult.value.health) {
      const h = localResult.value.health[key];
      sourceDetails[key] = { ...sourceDetails[key], ...h };
      if (h.ok !== undefined) healthResults[key] = h.ok;
    }
  } else {
    errors.push(`local pipeline: ${localResult.reason}`);
    console.error("[runner] local pipeline failed:", localResult.reason);
  }

  if (visaResult.status === "fulfilled") {
    visaJobs = visaResult.value.jobs;
    for (const key in visaResult.value.health) {
      const h = visaResult.value.health[key];
      sourceDetails[key] = { ...sourceDetails[key], ...h };
      if (h.ok !== undefined) healthResults[key] = h.ok;
    }
  } else {
    errors.push(`visa pipeline: ${visaResult.reason}`);
    console.error("[runner] visa pipeline failed:", visaResult.reason);
  }

  if (remoteResult.status === "fulfilled") {
    globalJobs = remoteResult.value.jobs;
    for (const key in remoteResult.value.health) {
      const h = remoteResult.value.health[key];
      sourceDetails[key] = { ...sourceDetails[key], ...h };
      if (h.ok !== undefined) healthResults[key] = h.ok;
    }
  } else {
    errors.push(`remote pipeline: ${remoteResult.reason}`);
    console.error("[runner] remote pipeline failed:", remoteResult.reason);
  }

  // Handle Workable 429 escalate if nothing was found (indicates a general block)
  if (localJobs.length === 0 && visaJobs.length === 0 && globalJobs.length === 0) {
    const slugs429 = getWorkable429SlugsThisRun();
    if (slugs429.length) {
      markWorkableSlugsBlocked24h(slugs429);
      console.warn(
        `[runner] All pipelines returned 0; marked ${slugs429.length} Workable slug(s) blocked 24h: ${slugs429.join(", ")}`,
      );
    }
  }

  const rawFetched = [...visaJobs, ...localJobs, ...globalJobs];

  // ── Gemini Filtration Layer ──
  const seenCandidateIds = new Set<string>();
  const newCandidates = rawFetched.filter((j) => {
    if (existingIds.has(j.id)) return false;
    if (seenCandidateIds.has(j.id)) return false;
    if (isClearlyNonFrontend(j.title) || isTooSeniorOrTooJunior(j.title)) return false;
    if (isGenericTitleButBackendRole(j.title, j.description)) return false;
    if (requiresCitizenshipOrClearance(j.title + " " + j.description)) return false;

    seenCandidateIds.add(j.id);
    return true;
  });

  console.log(`[runner] Running Gemini filter on ${newCandidates.length} new candidate(s)...`);
  const { passed: passedNewJobs, rejectedIds } = await filterJobsWithGemini(newCandidates);
  const rejectedSet = new Set(rejectedIds);

  // Filter rawFetched: keep existing, OR keep new IF it passed Gemini
  const fetched = rawFetched.filter((j) => {
    if (existingIds.has(j.id)) return true;
    if (rejectedSet.has(j.id)) return false;
    return passedNewJobs.some((pj) => pj.id === j.id);
  });

  const { store: updated, added } = mergeJobs(store, fetched);

  // ── Final Health Refinement ──
  const detailKeys = Object.keys(sourceDetails);
  for (const key in sourceDetails) {
    sourceDetails[key].count = 0;
    sourceDetails[key].geminiFiltered = 0;
  }

  rawFetched.forEach((j) => {
    const sName = (j.sourceName || j.company).toLowerCase().trim();
    const key = detailKeys.find((k) => k.toLowerCase().trim() === sName);
    if (key && sourceDetails[key]) {
      sourceDetails[key].count! += 1;
    }
  });

  newCandidates.forEach((j) => {
    if (rejectedSet.has(j.id)) {
      const sName = (j.sourceName || j.company).toLowerCase().trim();
      const key = detailKeys.find((k) => k.toLowerCase().trim() === sName);
      if (key && sourceDetails[key]) {
        sourceDetails[key].geminiFiltered! += 1;
      }
    }
  });

  // ── Bulk update health store once ──
  try {
    const finalHealth = await trackMultipleApiCalls(healthResults);
    // Sync the final stats back into sourceDetails for the log
    for (const key in sourceDetails) {
      if (finalHealth[key]) {
        sourceDetails[key].success = finalHealth[key].success;
        sourceDetails[key].total = finalHealth[key].total;
      }
    }
  } catch (e) {
    console.error("[runner] Failed to update health store:", e);
  }

  // Email alert only for brand-new visa-mode jobs
  const brandNewVisa = added.filter((j) => !existingIds.has(j.id) && j.mode === "visa");
  if (brandNewVisa.length) {
    try {
      await sendJobAlert(brandNewVisa);
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
    sources: { visa: visaJobs.length, local: localJobs.length, global: globalJobs.length },
    sourceDetails,
    durationMs,
    errors,
  };

  await finalizeBatchState();
  await writeStore(appendCronLog(updated, log));
  console.log(
    `[runner] Done in ${(durationMs / 1000).toFixed(1)}s — ${added.length} new, ${updated.jobs.length} total`,
  );
  return log;
}
