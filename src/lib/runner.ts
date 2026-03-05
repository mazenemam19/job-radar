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
    Object.assign(sourceDetails, localResult.value.health);
  } else {
    errors.push(`local pipeline: ${localResult.reason}`);
    console.error("[runner] local pipeline failed:", localResult.reason);
  }

  if (visaResult.status === "fulfilled") {
    visaJobs = visaResult.value.jobs;
    Object.assign(sourceDetails, visaResult.value.health);
  } else {
    errors.push(`visa pipeline: ${visaResult.reason}`);
    console.error("[runner] visa pipeline failed:", visaResult.reason);
  }

  if (remoteResult.status === "fulfilled") {
    globalJobs = remoteResult.value.jobs;
    Object.assign(sourceDetails, remoteResult.value.health);
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
  // Identify TRULY new jobs that passed regex but haven't been Gemini-checked yet.
  const seenCandidateIds = new Set<string>();
  const newCandidates = rawFetched.filter((j) => {
    if (existingIds.has(j.id)) return false;
    if (seenCandidateIds.has(j.id)) return false; // Prevent duplicate Gemini calls in same run
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
    // If it was a candidate, check if it passed
    return passedNewJobs.some((pj) => pj.id === j.id);
  });

  const { store: updated, added } = mergeJobs(store, fetched);

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
