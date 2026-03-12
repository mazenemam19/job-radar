import { readStore, writeStore, mergeJobs, appendCronLog, writeRawStore } from "./storage";
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
import { finalizeBatchState, readState } from "./state";
import { trackMultipleApiCalls } from "./health-store";
import type { Job, CronLog, SourceHealth } from "@/types";

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
  await readState(); // Initialize process state for lastUpdated timestamp
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

  const aggregateHealth = (health: Record<string, SourceHealth>) => {
    for (const key in health) {
      const h = health[key];
      if (!sourceDetails[key]) {
        sourceDetails[key] = { ...h };
      } else {
        // Additive fields
        sourceDetails[key].count = (sourceDetails[key].count || 0) + (h.count || 0);
        sourceDetails[key].rawCount = (sourceDetails[key].rawCount || 0) + (h.rawCount || 0);
        sourceDetails[key].geminiFiltered =
          (sourceDetails[key].geminiFiltered || 0) + (h.geminiFiltered || 0);
        // Overwrite or preserve descriptive fields
        if (h.error) sourceDetails[key].error = h.error;
        if (h.durationMs)
          sourceDetails[key].durationMs = (sourceDetails[key].durationMs || 0) + h.durationMs;
        if (h.ok !== undefined) sourceDetails[key].ok = sourceDetails[key].ok && h.ok;
      }
      if (h.ok !== undefined) healthResults[key] = h.ok;
    }
  };

  if (localResult.status === "fulfilled") {
    localJobs = localResult.value.jobs;
    aggregateHealth(localResult.value.health);
  } else {
    errors.push(`local pipeline: ${localResult.reason}`);
    console.error("[runner] local pipeline failed:", localResult.reason);
  }

  if (visaResult.status === "fulfilled") {
    visaJobs = visaResult.value.jobs;
    aggregateHealth(visaResult.value.health);
  } else {
    errors.push(`visa pipeline: ${visaResult.reason}`);
    console.error("[runner] visa pipeline failed:", visaResult.reason);
  }

  if (remoteResult.status === "fulfilled") {
    globalJobs = remoteResult.value.jobs;
    aggregateHealth(remoteResult.value.health);
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

  // ── Raw Market Persistence ──
  await writeRawStore(rawFetched);

  // ── Gemini Filtration Layer ──
  const seenCandidateIds = new Set<string>();
  const newCandidates = rawFetched.filter((j) => {
    if (existingIds.has(j.id)) return false;
    if (seenCandidateIds.has(j.id)) return false;
    if (isClearlyNonFrontend(j.title) || isTooSeniorOrTooJunior(j.title, j.mode)) return false;
    if (isGenericTitleButBackendRole(j.title, j.description)) return false;
    if (requiresCitizenshipOrClearance(j.title + " " + j.description)) return false;

    seenCandidateIds.add(j.id);
    return true;
  });

  console.log(`[runner] Running Gemini filter on ${newCandidates.length} new candidate(s)...`);
  const { passed: passedNewJobs, rejectedIds } = await filterJobsWithGemini(newCandidates);
  const rejectedSet = new Set(rejectedIds);

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
    sourceDetails[key].totalSurvivors = 0;
  }

  // 1. Count technical matches from this run (Passed Regex)
  rawFetched.forEach((j) => {
    const sName = (j.sourceName || j.company).toLowerCase().trim();
    const key = detailKeys.find((k) => k.toLowerCase().trim() === sName);
    if (key && sourceDetails[key]) {
      sourceDetails[key].count! += 1;
    }
  });

  // 2. Count Gemini rejections from this run
  newCandidates.forEach((j) => {
    if (rejectedSet.has(j.id)) {
      const sName = (j.sourceName || j.company).toLowerCase().trim();
      const key = detailKeys.find((k) => k.toLowerCase().trim() === sName);
      if (key && sourceDetails[key]) {
        sourceDetails[key].geminiFiltered! += 1;
      }
    }
  });

  // 3. Count TOTAL survivors currently in the store (Cumulative 7-day)
  updated.jobs.forEach((j) => {
    const sName = (j.sourceName || j.company).toLowerCase().trim();
    const key = detailKeys.find((k) => k.toLowerCase().trim() === sName);
    if (key && sourceDetails[key]) {
      sourceDetails[key].totalSurvivors! += 1;
    }
  });

  try {
    const finalHealth = await trackMultipleApiCalls(healthResults);
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
    sources: {
      visa: added.filter((j) => j.mode === "visa").length,
      local: added.filter((j) => j.mode === "local").length,
      global: added.filter((j) => j.mode === "global").length,
    },
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
