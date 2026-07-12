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
 * settings. Returns a coarse superset for required-keywords/skill-match --
 * callers MUST still run the exact hasMeaningfulKeywordMatch() check on the
 * result before treating it as final (see plan §2.3 and §3.2).
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

  // @ts-expect-error -- jr_get_filtered_raw_jobs isn't in the generated Functions
  // union in database.types.ts yet: that file is generated from a deployed
  // project's schema, and this function won't exist in any deployed project
  // until Task 1 (supabase/migrations/20260711000000_jr_filtered_raw_jobs.sql)
  // is actually applied and `supabase gen types typescript` is re-run against
  // it. IMPORTANT: keep this as ONE inline call (name + args object together) --
  // extracting the args into a separate `const params = {...}` first was tried
  // and makes TS silently fall back to an unchecked path instead of raising this
  // error, which loses real argument-shape checking once the types ARE
  // regenerated. Remove this directive once that regeneration happens -- if the
  // error is gone, @ts-expect-error will itself fail the build as a reminder.
  const { data, error } = await db.rpc("jr_get_filtered_raw_jobs", {
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
    p_blacklist_terms: settings.blacklisted_locations,
    p_global_allowed_terms: settings.global_mode_allowed_locations,
    p_global_blocked_terms: settings.global_mode_blocked_regions,
    p_limit: limit,
  });

  if (error) {
    throw new Error(`fetchFilteredRawJobs failed: ${error.message}`);
  }

  return data as unknown as FilteredRawJobsResult;
}
