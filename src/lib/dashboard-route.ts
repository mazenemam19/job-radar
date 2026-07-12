// src/lib/dashboard-route.ts
// Pure rebuild logic for GET /api/dashboard.
// No Next.js Request/Response, no Supabase calls — only transforms.
// Kept separate so it's unit-testable without mocking the route layer.

import { filterJobsWithGemini } from "@/lib/gemini";
import {
  scoreJob,
  mergeJobs,
  passesRequiredKeywordsGate,
  passesSkillMatchGate,
} from "@/lib/scoring";
import type { RawJob, ScoredJob, PipelineLog, ResolvedSettings } from "@/lib/types";
import type { RawJobsFunnel } from "@/lib/raw-jobs-query";

export type FeedResult = {
  finalJobs: ScoredJob[];
  pipelineLog: PipelineLog;
};

/**
 * Applies the remaining pipeline stages (precision recheck → Gemini → score →
 * merge) to a raw job pool that has ALREADY passed date, seniority, excluded-
 * keywords, blacklisted-locations, and global-mode filtering at the DB level
 * (see fetchFilteredRawJobs() in raw-jobs-query.ts). `rawJobs` here also
 * carries a COARSE superset for required-keywords/skill-match -- the precision
 * recheck below is what actually enforces hasMeaningfulKeywordMatch()'s
 * boilerplate-window logic, which the SQL deliberately does not replicate
 * (see docs/plans/2026-07-11-db-level-job-filtering.md §2.3).
 *
 * `dbFunnelCounts` carries total_fetched/after_date_filter through from the
 * RPC's funnel object -- this function no longer has enough information to
 * compute them itself, since it never sees the unfiltered pool.
 */
export async function buildFeed(
  rawJobs: RawJob[],
  dbFunnelCounts: Pick<RawJobsFunnel, "total_fetched" | "after_date_filter">,
  settings: ResolvedSettings,
  geminiApiKey: string | null | undefined,
): Promise<FeedResult> {
  // Stage: exact precision recheck for required-keywords/skill-match.
  const afterPrecisionFilter = rawJobs.filter(
    (j) => passesRequiredKeywordsGate(j, settings) && passesSkillMatchGate(j, settings),
  );

  // Stage: Gemini filter — skipped when no key, fails open on error
  const geminiFiltered = geminiApiKey
    ? await filterJobsWithGemini(geminiApiKey, afterPrecisionFilter, settings)
    : afterPrecisionFilter.map((j) => ({
        ...j,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: false,
        gemini_quota_exhausted: false,
      }));

  // Stage: Score — jobs with total_score ≤ 0 are discarded here
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

  // Stage: Merge — deduplicates and sorts by total_score descending.
  // Empty first arg is intentional: this is a full rebuild path, not an
  // incremental merge — there are no pre-existing cached jobs to preserve.
  const finalJobs = mergeJobs([], scoredJobs);

  const pipelineLog: PipelineLog = {
    total_fetched: dbFunnelCounts.total_fetched,
    after_date_filter: dbFunnelCounts.after_date_filter,
    // NOTE: this now includes global-mode attrition, which used to be
    // invisibly bundled into "after your Gemini filter" -- a deliberate,
    // disclosed redefinition, not an accident. See plan §4.2.
    after_settings_filter: afterPrecisionFilter.length,
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
