// src/lib/raw-jobs-query.ts
// Fetches the bounded candidate pool for the dashboard. The database applies
// pipeline, date, location, and job-type criteria before its row limit. Text
// settings gates remain in buildFeed(), where their existing semantics can run
// without a wider age range causing a Postgres statement timeout.

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
  after_workplace_filter: number;
  after_employment_filter: number;
  after_location_filter: number;
}

export interface FilteredRawJobsResult {
  jobs: RawJob[];
  funnel: RawJobsFunnel;
}

function countOrFallback(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * A dashboard deploy can reach a cached or not-yet-migrated RPC response for
 * a short period. Normalize that legacy shape so the funnel remains readable
 * while the additive SQL migration is applied.
 */
export function normalizeFilteredResult(data: unknown): FilteredRawJobsResult {
  if (typeof data !== "object" || data === null) {
    throw new Error("Profile jobs RPC returned an invalid response");
  }

  const response = data as { jobs?: unknown; funnel?: unknown };
  if (
    !Array.isArray(response.jobs) ||
    typeof response.funnel !== "object" ||
    response.funnel === null
  ) {
    throw new Error("Profile jobs RPC returned an incomplete response");
  }

  const source = response.funnel as Record<string, unknown>;
  const total = countOrFallback(source.total_fetched, 0);
  const afterDate = countOrFallback(source.after_date_filter, total);
  const afterWorkplace = countOrFallback(source.after_workplace_filter, afterDate);
  const afterEmployment = countOrFallback(source.after_employment_filter, afterWorkplace);
  const afterLocation = countOrFallback(
    source.after_location_filter,
    countOrFallback(source.after_settings_filter_coarse, afterEmployment),
  );

  return {
    jobs: response.jobs as RawJob[],
    funnel: {
      total_fetched: total,
      after_date_filter: afterDate,
      after_workplace_filter: afterWorkplace,
      after_employment_filter: afterEmployment,
      after_location_filter: afterLocation,
    },
  };
}

/**
 * Fetches raw_jobs pre-filtered at the DB level for the given modes and
 * settings. The user's location and job-type profile is applied before the
 * row limit; unknown location or type values remain visible for review.
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

  return normalizeFilteredResult(data);
}
