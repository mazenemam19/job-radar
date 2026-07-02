// src/lib/defaults-form.ts
// Pure logic backing DefaultsForm — no React, no fetch. Every function here
// is a plain transform so it can be unit tested without mounting a component.

import type { DefaultSettings } from "@/lib/types";
import { csvListToString, parseCsvList } from "@/lib/settings-form";

/** Editable state backing the admin defaults form. CSV fields stay raw
 *  strings until save; fields this form doesn't expose (bonus_skills,
 *  pipeline flags, scoring weights, email/salary toggles) are omitted —
 *  the API applies a partial patch, so untouched columns are left as-is. */
export interface DefaultsFormFields {
  expertSkills: string;
  secondarySkills: string;
  jobAgeDays: number;
  geminiPrompt: string;
  seniorityLevels: string;
  juniorKeywords: string;
  midKeywords: string;
  seniorKeywords: string;
  staffKeywords: string;
  excludedKeywords: string;
  requiredKeywords: string;
  blacklistedLocations: string;
  globalBlockedRegions: string;
  globalAllowedLocations: string;
  scoreDenominator: number;
}

export const DEFAULT_FORM_FIELDS: DefaultsFormFields = {
  expertSkills: "",
  secondarySkills: "",
  jobAgeDays: 7,
  geminiPrompt: "",
  seniorityLevels: "",
  juniorKeywords: "",
  midKeywords: "",
  seniorKeywords: "",
  staffKeywords: "",
  excludedKeywords: "",
  requiredKeywords: "",
  blacklistedLocations: "",
  globalBlockedRegions: "",
  globalAllowedLocations: "",
  scoreDenominator: 18,
};

/** Maps a fetched DefaultSettings into the form's editable field shape. */
export function hydrateFormFields(defaults: DefaultSettings): DefaultsFormFields {
  return {
    expertSkills: csvListToString(defaults.expert_skills),
    secondarySkills: csvListToString(defaults.secondary_skills),
    jobAgeDays: defaults.job_age_days ?? 7,
    geminiPrompt: defaults.gemini_filter_prompt ?? "",
    seniorityLevels: csvListToString(defaults.seniority_levels),
    juniorKeywords: csvListToString(defaults.junior_keywords),
    midKeywords: csvListToString(defaults.mid_keywords),
    seniorKeywords: csvListToString(defaults.senior_keywords),
    staffKeywords: csvListToString(defaults.staff_keywords),
    excludedKeywords: csvListToString(defaults.excluded_keywords),
    requiredKeywords: csvListToString(defaults.required_keywords),
    blacklistedLocations: csvListToString(defaults.blacklisted_locations),
    globalBlockedRegions: csvListToString(defaults.global_mode_blocked_regions),
    globalAllowedLocations: csvListToString(defaults.global_mode_allowed_locations),
    scoreDenominator: defaults.score_denominator ?? 18,
  };
}

/** Builds the PUT /api/admin/defaults body. Only fields this form edits are
 * included — the API applies a partial patch, so omitted columns
 * (bonus_skills, pipeline_local/global, scoring_weights, email/salary
 * toggles) are left untouched server-side. */
export function buildDefaultsPayload(fields: DefaultsFormFields): Record<string, unknown> {
  return {
    expert_skills: parseCsvList(fields.expertSkills),
    secondary_skills: parseCsvList(fields.secondarySkills),
    job_age_days: fields.jobAgeDays,
    gemini_filter_prompt: fields.geminiPrompt,
    seniority_levels: parseCsvList(fields.seniorityLevels),
    junior_keywords: parseCsvList(fields.juniorKeywords),
    mid_keywords: parseCsvList(fields.midKeywords),
    senior_keywords: parseCsvList(fields.seniorKeywords),
    staff_keywords: parseCsvList(fields.staffKeywords),
    excluded_keywords: parseCsvList(fields.excludedKeywords),
    required_keywords: parseCsvList(fields.requiredKeywords),
    blacklisted_locations: parseCsvList(fields.blacklistedLocations),
    global_mode_blocked_regions: parseCsvList(fields.globalBlockedRegions),
    global_mode_allowed_locations: parseCsvList(fields.globalAllowedLocations),
    score_denominator: fields.scoreDenominator,
  };
}
