// src/lib/raw-jobs-query.ts
// Replaces the .select("*").in("mode",...).order().limit(2000) call that used
// to live in src/app/api/dashboard/route.ts. Filtering that previously ran in
// Node, per user, per request (date, seniority, excluded keywords, blacklisted
// locations, and a coarse pass of required-keywords/skill-match) now happens in
// the jr_get_filtered_raw_jobs() Postgres function -- see
// docs/plans/2026-07-11-db-level-job-filtering.md for the full rationale.
//
// The Gemini gate, scoreJob(), and mergeJobs() are NOT part of this -- they stay
// in buildFeed() exactly as before. The exact hasMeaningfulKeywordMatch() recheck
// for required-keywords/skill-match also stays in buildFeed(): this module only
// returns a coarse superset for those two gates (see plan §2.3).

import { createAdminClient } from "./supabase/admin";
import { filterWorkAuthorizationBlacklistTerms } from "./job-signals";
import type { RawJob, ResolvedSettings, SeniorityLevel } from "./types";

const LEVEL_KEYWORD_FIELDS = {
  junior: "junior_keywords",
  mid: "mid_keywords",
  senior: "senior_keywords",
  staff: "staff_keywords",
} as const satisfies Record<SeniorityLevel, keyof ResolvedSettings>;

export interface RawJobsFunnel {
  total_fetched: number;
  after_date_filter: number;
  /**
   * Rows passing date + seniority + excluded-keywords + blacklist + global-mode,
   * plus a COARSE ("any keyword, anywhere") superset for required-keywords and
   * skill-match. NOT the same number as PipelineLog.after_settings_filter --
   * buildFeed() must recompute that from the array length after running the
   * exact hasMeaningfulKeywordMatch() precision recheck. See plan §4.2.
   */
  after_settings_filter_coarse: number;
}

export interface FilteredRawJobsResult {
  jobs: RawJob[];
  funnel: RawJobsFunnel;
}

/**
 * Fetches raw_jobs pre-filtered at the DB level for the given modes and
 * settings. The user's location and job-type profile is applied before the
 * row limit; unknown location or type values remain visible for review.
 * Returns a coarse superset for required-keywords/skill-match -- callers MUST
 * still run the exact hasMeaningfulKeywordMatch() check (see plan §2.3 and §3.2).
 */
export async function fetchFilteredRawJobs(
  modes: string[],
  settings: ResolvedSettings,
  limit = 2000,
): Promise<FilteredRawJobsResult> {
  const db = createAdminClient();

  const requiredTerms =
    settings.required_keywords.length > 0 ? settings.required_keywords : settings.expert_skills;

  const selectedLevelTerms = settings.seniority_levels.flatMap(
    (level) => settings[LEVEL_KEYWORD_FIELDS[level]] as string[],
  );

  // @ts-expect-error -- the tracked SQL migration adds this RPC; generated DB
  // types do not yet include it. Keep the RPC name and arguments inline so a
  // later type regeneration validates the argument shape.
  const { data, error } = await db.rpc("jr_get_filtered_raw_jobs_for_profile", {
    p_modes: modes,
    p_job_age_days: settings.job_age_days,
    p_all_level_terms: [
      ...settings.junior_keywords,
      ...settings.mid_keywords,
      ...settings.senior_keywords,
      ...settings.staff_keywords,
    ],
    p_selected_level_terms: selectedLevelTerms,
    p_excluded_terms: settings.excluded_keywords,
    p_required_terms: requiredTerms,
    p_skill_terms: [...settings.expert_skills, ...settings.secondary_skills],
    p_blacklist_terms: filterWorkAuthorizationBlacklistTerms(settings.blacklisted_locations),
    p_global_allowed_terms: settings.global_mode_allowed_locations,
    p_global_blocked_terms: settings.global_mode_blocked_regions,
    p_search_profile: settings.search_profile,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`fetchFilteredRawJobs failed: ${error.message}`);
  }

  return data as unknown as FilteredRawJobsResult;
}
