// src/lib/dashboard-route.ts
// Pure rebuild logic for GET /api/dashboard.
// No Next.js Request/Response, no Supabase calls — only transforms.
// Kept separate so it's unit-testable without mocking the route layer.

import { filterJobsWithGemini } from "@/lib/gemini";
import {
  scoreJob,
  mergeJobs,
  passesDateGate,
  passesSettingsGate,
  passesGlobalModeGate,
} from "@/lib/scoring";
import type { RawJob, ScoredJob, PipelineLog, ResolvedSettings } from "@/lib/types";

export type FeedResult = {
  finalJobs: ScoredJob[];
  pipelineLog: PipelineLog;
};

/** Applies every pipeline stage (date → settings → global-mode → Gemini → score → merge)
 *  to the supplied raw job pool and returns the final job list with its pipeline log. */
export async function buildFeed(
  rawJobs: RawJob[],
  settings: ResolvedSettings,
  geminiApiKey: string | null | undefined,
): Promise<FeedResult> {
  const totalFetched = rawJobs.length;

  // Stage 1: Date filter
  const afterDateFilter = rawJobs.filter((j) => passesDateGate(j, settings.job_age_days));

  // Stage 2: Settings filter (seniority + tech stack + regex gates)
  const afterSettingsFilter = afterDateFilter.filter((j) => passesSettingsGate(j, settings));

  // Stage 3: Global-mode timezone/region filter (only for "global" pipeline jobs)
  const afterGlobalModeFilter = afterSettingsFilter.filter((j) =>
    j.mode === "global" ? passesGlobalModeGate(j, settings) : true,
  );

  // Stage 4: Gemini filter — skipped when no key, fails open on error
  const geminiFiltered = geminiApiKey
    ? await filterJobsWithGemini(geminiApiKey, afterGlobalModeFilter, settings)
    : afterGlobalModeFilter.map((j) => ({
        ...j,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: false,
        gemini_quota_exhausted: false,
      }));

  // Stage 5: Score — jobs with total_score ≤ 0 are discarded here
  const scoredJobs: ScoredJob[] = [];
  for (const job of geminiFiltered) {
    const scored = scoreJob(
      job,
      settings,
      job.gemini_pass,
      job.gemini_reason,
      job.gemini_reviewed,
      job.gemini_quota_exhausted,
    );
    if (scored && scored.total_score > 0) {
      scoredJobs.push(scored);
    }
  }

  // Stage 6: Merge — deduplicates and sorts by total_score descending.
  // Empty first arg is intentional: this is a full rebuild path, not an
  // incremental merge — there are no pre-existing cached jobs to preserve.
  const finalJobs = mergeJobs([], scoredJobs);

  const pipelineLog: PipelineLog = {
    total_fetched: totalFetched,
    after_date_filter: afterDateFilter.length,
    after_settings_filter: afterSettingsFilter.length,
    after_gemini_filter: geminiFiltered.length,
    after_scoring: finalJobs.length,
    cached_at: new Date().toISOString(),
  };

  return { finalJobs, pipelineLog };
}

/** Returns the list of pipeline modes enabled by the user's settings. */
export function enabledModes(settings: ResolvedSettings): string[] {
  const modes: string[] = [];
  if (settings.pipeline_local) modes.push("local");
  if (settings.pipeline_global) modes.push("global");
  return modes;
}
