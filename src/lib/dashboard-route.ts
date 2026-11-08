// src/lib/dashboard-route.ts
// Pure rebuild logic for GET /api/dashboard.
// No Next.js Request/Response, no Supabase calls — only transforms.
// Kept separate so it's unit-testable without mocking the route layer.

import { filterJobsWithGemini } from "@/lib/gemini";
import { explainSearchProfileMatch } from "@/lib/search-profile-match";
import { scoreJob, mergeJobs, passesSettingsGate, passesGlobalModeGate } from "@/lib/scoring";
import type { RawJob, ScoredJob, PipelineLog, ResolvedSettings } from "@/lib/types";
import type { RawJobsFunnel } from "@/lib/raw-jobs-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type FeedResult = {
  finalJobs: ScoredJob[];
  pipelineLog: PipelineLog;
};

/**
 * A user-initiated rebuild must run the pipeline even when the last result is
 * still fresh. Keeping this decision pure makes the route's cache contract
 * explicit and regression-testable.
 */
export function shouldServeDashboardCache(cacheIsFresh: boolean, forceRebuild: boolean): boolean {
  return cacheIsFresh && !forceRebuild;
}

function hasLocationToConfirm(settings: ResolvedSettings): boolean {
  return (settings.search_profile?.locations.length ?? 0) > 0;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/**
 * A fast, deliberately broad candidate check before the regex-heavy exact
 * gates. Any exact word-boundary match remains a substring after whitespace
 * normalization, so this cannot discard a job that the exact gates would pass.
 */
function hasQuickCandidate(text: string, terms: string[]): boolean {
  return terms.some((term) => {
    const normalizedTerm = normalizeText(term).trim();
    return normalizedTerm.length > 0 && text.includes(normalizedTerm);
  });
}

function passesQuickTextCandidate(
  job: RawJob,
  requiredTerms: string[],
  skillTerms: string[],
): boolean {
  const combinedText = normalizeText(`${job.title} ${job.description} ${job.location}`);
  const description = normalizeText(job.description);
  const hasRequiredTerm =
    requiredTerms.length === 0 || hasQuickCandidate(combinedText, requiredTerms);

  return hasRequiredTerm && hasQuickCandidate(description, skillTerms);
}

/**
 * Applies the in-memory settings gates → Gemini → score → merge to a raw job
 * pool that has already passed inexpensive DB-side date/location/type filters.
 * Text matching stays here: the candidate pool is limited only after the
 * user's location and job type are applied, so a wider age window cannot make
 * Postgres time out while existing keyword semantics are preserved.
 *
 * `dbFunnelCounts` carries the server-side date, workplace, employment-type,
 * and location stages through from the RPC's funnel object. This function
 * never sees the unfiltered pool, so it must not infer those counts.
 */
export async function buildFeed(
  rawJobs: RawJob[],
  dbFunnelCounts: Pick<
    RawJobsFunnel,
    | "total_fetched"
    | "after_date_filter"
    | "after_workplace_filter"
    | "after_employment_filter"
    | "after_location_filter"
  >,
  settings: ResolvedSettings,
  geminiApiKey: string | null | undefined,
  userId: string,
  db: SupabaseClient<Database>,
  requestDeadlineAt?: number,
): Promise<FeedResult> {
  const requiredTerms =
    settings.required_keywords.length > 0 ? settings.required_keywords : settings.expert_skills;
  const skillTerms = [...settings.expert_skills, ...settings.secondary_skills];

  // Cheap substring checks shrink the profile-scoped pool before the richer
  // regex gates scan long ATS descriptions. Exact gates below remain the
  // authority for a final match.
  const quickTextCandidates = rawJobs.filter((job) =>
    passesQuickTextCandidate(job, requiredTerms, skillTerms),
  );

  // Stage: settings gates. The database bounds this by date/location/type;
  // text matching here uses the full, well-tested application semantics.
  const afterSettingsFilter = quickTextCandidates.filter(
    (job) => passesSettingsGate(job, settings) && passesGlobalModeGate(job, settings),
  );

  // Stage: Gemini filter — skipped when no key, fails open on error
  const geminiFiltered = geminiApiKey
    ? requestDeadlineAt === undefined
      ? await filterJobsWithGemini(geminiApiKey, afterSettingsFilter, settings, userId, db)
      : await filterJobsWithGemini(
          geminiApiKey,
          afterSettingsFilter,
          settings,
          userId,
          db,
          requestDeadlineAt,
        )
    : afterSettingsFilter.map((j) => ({
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
  const finalJobs = mergeJobs([], scoredJobs).map((job) => {
    const locationUncertain = hasLocationToConfirm(settings) && !job.country_code;
    const locationMatchStatus: ScoredJob["location_match_status"] = locationUncertain
      ? "uncertain"
      : "confirmed";
    return {
      ...job,
      location_match_status: locationMatchStatus,
      search_profile_match: settings.search_profile
        ? explainSearchProfileMatch(job, settings.search_profile)
        : null,
    };
  });
  const confirmedJobs = finalJobs.filter((job) => job.location_match_status !== "uncertain");

  const pipelineLog: PipelineLog = {
    total_fetched: dbFunnelCounts.total_fetched,
    after_date_filter: dbFunnelCounts.after_date_filter,
    after_workplace_filter: dbFunnelCounts.after_workplace_filter,
    after_employment_filter: dbFunnelCounts.after_employment_filter,
    after_location_filter: dbFunnelCounts.after_location_filter,
    after_settings_filter: afterSettingsFilter.length,
    after_gemini_filter: geminiFiltered.length,
    after_scoring: confirmedJobs.length,
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
