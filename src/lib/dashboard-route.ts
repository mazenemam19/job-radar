// src/lib/dashboard-route.ts
// Pure rebuild logic for GET /api/dashboard.
// No Next.js Request/Response, no Supabase calls — only transforms.
// Kept separate so it's unit-testable without mocking the route layer.

import { filterJobsWithGeminiVerbose } from "@/lib/gemini";
import {
  scoreJob,
  mergeJobs,
  explainDateGate,
  explainSeniorityGate,
  explainExcludedKeywordsGate,
  explainRequiredKeywordsGate,
  explainBlacklistedLocationsGate,
  explainSkillMatchGate,
  explainGlobalModeGate,
} from "@/lib/scoring";
import { MAX_PIPELINE_SAMPLE } from "@/lib/types";
import type {
  RawJob,
  ScoredJob,
  GateLog,
  GateBreakdown,
  DroppedJobEntry,
  ResolvedSettings,
} from "@/lib/types";

export type FeedResult = {
  finalJobs: ScoredJob[];
  gateLog: GateLog;
};

function toEntry(job: RawJob, reason: string | null): DroppedJobEntry {
  return { id: job.id, title: job.title, company: job.company, reason };
}

// rawJobs (and therefore every survivors[] derived from it) arrives sorted
// fetched_at descending from the SQL query in the route handler — filtering
// preserves that order, so slicing the front of a dropped list already
// gives "most recently fetched N", no extra sort needed here.
function capSample(entries: DroppedJobEntry[]): DroppedJobEntry[] {
  return entries.slice(0, MAX_PIPELINE_SAMPLE);
}

/** Runs one gate's explain function over `pool`, splitting it into jobs that
 *  passed (carried into the next stage) and a capped/counted breakdown of
 *  what was dropped and why. One shared shape for every gate — including
 *  gates like global_mode where `explain` may be a passthrough for jobs the
 *  gate doesn't apply to. */
function runGate(
  pool: RawJob[],
  explain: (job: RawJob) => { pass: boolean; reason: string | null },
): { survivors: RawJob[]; breakdown: GateBreakdown } {
  const survivors: RawJob[] = [];
  const dropped: DroppedJobEntry[] = [];
  for (const job of pool) {
    const { pass, reason } = explain(job);
    if (pass) {
      survivors.push(job);
    } else {
      dropped.push(toEntry(job, reason));
    }
  }
  return { survivors, breakdown: { count: dropped.length, sample: capSample(dropped) } };
}

/** Applies every pipeline stage (date → seniority → excluded keywords →
 *  required keywords → blacklisted locations → skill match → global-mode →
 *  Gemini → score → merge) to the supplied raw job pool and returns the
 *  final job list with a full per-gate breakdown of what was dropped and why.
 *
 *  Ingestion-level losses (wrong pipeline mode, outside the 2000-row candidate
 *  window) happen before this function is ever called — they require DB
 *  queries this pure function has no client for. The route handler computes
 *  those separately and merges them into the final PipelineLog. */
export async function buildFeed(
  rawJobs: RawJob[],
  settings: ResolvedSettings,
  geminiApiKey: string | null | undefined,
): Promise<FeedResult> {
  const dateResult = runGate(rawJobs, (j) => explainDateGate(j, settings.job_age_days));
  const seniorityResult = runGate(dateResult.survivors, (j) => explainSeniorityGate(j, settings));
  const excludedResult = runGate(seniorityResult.survivors, (j) =>
    explainExcludedKeywordsGate(j, settings),
  );
  const requiredResult = runGate(excludedResult.survivors, (j) =>
    explainRequiredKeywordsGate(j, settings),
  );
  const blacklistResult = runGate(requiredResult.survivors, (j) =>
    explainBlacklistedLocationsGate(j, settings),
  );
  const skillResult = runGate(blacklistResult.survivors, (j) => explainSkillMatchGate(j, settings));
  const globalModeResult = runGate(skillResult.survivors, (j) =>
    j.mode === "global" ? explainGlobalModeGate(j, settings) : { pass: true, reason: null },
  );

  // Gemini stage — verbose variant keeps failures (with reason) instead of
  // silently dropping them, at zero extra API cost over the old behavior
  // (same batched calls, just a fuller return shape).
  const geminiPool = globalModeResult.survivors;
  const geminiDecisions = geminiApiKey
    ? await filterJobsWithGeminiVerbose(geminiApiKey, geminiPool, settings)
    : geminiPool.map((j) => ({
        id: j.id,
        pass: true,
        reason: null as string | null,
        reviewed: false,
        quotaExhausted: false,
      }));
  const geminiById = new Map(geminiDecisions.map((d) => [d.id, d]));

  const geminiSurvivors: Array<
    RawJob & {
      gemini_pass: boolean;
      gemini_reason: string | null;
      gemini_reviewed: boolean;
      gemini_quota_exhausted: boolean;
    }
  > = [];
  const geminiDropped: DroppedJobEntry[] = [];
  for (const job of geminiPool) {
    // geminiDecisions always has an entry for every job in geminiPool (both
    // filterJobsWithGeminiVerbose and the no-key fallback above guarantee
    // it) — the `!` reflects that invariant, not an assumption.
    const d = geminiById.get(job.id)!;
    if (d.pass) {
      geminiSurvivors.push({
        ...job,
        gemini_pass: true,
        gemini_reason: d.reason,
        gemini_reviewed: d.reviewed,
        gemini_quota_exhausted: d.quotaExhausted,
      });
    } else {
      geminiDropped.push(toEntry(job, d.reason));
    }
  }
  const geminiBreakdown: GateBreakdown = {
    count: geminiDropped.length,
    sample: capSample(geminiDropped),
  };

  // Scoring stage — total_score <= 0 is dropped here, same as before, now
  // also captured with a reason for the breakdown.
  const scoredJobs: ScoredJob[] = [];
  const scoringDropped: DroppedJobEntry[] = [];
  for (const job of geminiSurvivors) {
    const scored = scoreJob(
      job,
      settings,
      job.gemini_pass,
      job.gemini_reason,
      job.gemini_reviewed,
      job.gemini_quota_exhausted,
    );
    // scored === null only if scoreJob's internal seniority re-check fails —
    // unreachable here since seniority already passed in this same pass
    // (see explainSeniorityGate above). Falling through silently matches
    // today's existing behavior (`if (scored && ...)`) rather than inventing
    // a gate that can't fire in practice.
    if (!scored) continue;
    if (scored.total_score > 0) {
      scoredJobs.push(scored);
    } else {
      scoringDropped.push(toEntry(job, `final score ${scored.total_score} is not above 0`));
    }
  }
  const scoringBreakdown: GateBreakdown = {
    count: scoringDropped.length,
    sample: capSample(scoringDropped),
  };

  // Merge — deduplicates and sorts by total_score descending. Empty first
  // arg is intentional: this is a full rebuild path, not an incremental
  // merge — there are no pre-existing cached jobs to preserve.
  const finalJobs = mergeJobs([], scoredJobs);

  const gateLog: GateLog = {
    candidate_window: rawJobs.length,
    on_dashboard: finalJobs.length,
    gates: {
      date: dateResult.breakdown,
      seniority: seniorityResult.breakdown,
      excluded_keywords: excludedResult.breakdown,
      required_keywords: requiredResult.breakdown,
      blacklisted_locations: blacklistResult.breakdown,
      skill_match: skillResult.breakdown,
      global_mode: globalModeResult.breakdown,
      gemini: geminiBreakdown,
      scoring: scoringBreakdown,
    },
  };

  return { finalJobs, gateLog };
}

/** Returns the list of pipeline modes enabled by the user's settings. */
export function enabledModes(settings: ResolvedSettings): string[] {
  const modes: string[] = [];
  if (settings.pipeline_local) modes.push("local");
  if (settings.pipeline_global) modes.push("global");
  return modes;
}
