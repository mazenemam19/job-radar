// src/lib/settings-form.ts
// Pure logic backing SettingsForm — no React, no fetch. Every function here
// is a plain transform so it can be unit tested without mounting a component.

import type { ResolvedSettings, SettingsFormFields } from "@/lib/types";

export const DEFAULT_FORM_FIELDS: SettingsFormFields = {
  geminiKey: "",
  clearGeminiKey: false,
  expertSkills: "",
  secondarySkills: "",
  jobAgeDays: 7,
  pipelineLocal: true,
  pipelineGlobal: true,
  seniorityLevels: new Set(["senior", "staff"]),
  juniorKeywords: "",
  midKeywords: "",
  seniorKeywords: "",
  staffKeywords: "",
  emailAlerts: true,
  salaryReminders: true,
  geminiPrompt: "",
  skillWeight: 60,
  recencyWeight: 30,
  excludedKeywords: "",
  blacklistedLocations: "",
  requiredKeywords: "",
  globalBlockedRegions: "",
  globalAllowedLocations: "",
};

/** "react, node,  next.js" -> ["react", "node", "next.js"] */
export function parseCsvList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ["react", "node"] -> "react, node" */
export function csvListToString(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

/** Maps a fetched ResolvedSettings into the form's editable field shape. */
export function hydrateFormFields(resolved: ResolvedSettings): SettingsFormFields {
  return {
    ...DEFAULT_FORM_FIELDS,
    expertSkills: csvListToString(resolved.expert_skills),
    secondarySkills: csvListToString(resolved.secondary_skills),
    jobAgeDays: resolved.job_age_days ?? 7,
    pipelineLocal: resolved.pipeline_local ?? true,
    pipelineGlobal: resolved.pipeline_global ?? true,
    seniorityLevels: new Set(
      resolved.seniority_levels?.length ? resolved.seniority_levels : ["senior", "staff"],
    ),
    juniorKeywords: csvListToString(resolved.junior_keywords),
    midKeywords: csvListToString(resolved.mid_keywords),
    seniorKeywords: csvListToString(resolved.senior_keywords),
    staffKeywords: csvListToString(resolved.staff_keywords),
    emailAlerts: resolved.email_alerts_enabled ?? true,
    salaryReminders: resolved.salary_reminder_enabled ?? true,
    geminiPrompt: resolved.gemini_filter_prompt ?? "",
    skillWeight: resolved.scoring_weights ? Math.round(resolved.scoring_weights.skill * 100) : 60,
    recencyWeight: resolved.scoring_weights
      ? Math.round(resolved.scoring_weights.recency * 100)
      : 30,
    excludedKeywords: csvListToString(resolved.excluded_keywords),
    blacklistedLocations: csvListToString(resolved.blacklisted_locations),
    requiredKeywords: csvListToString(resolved.required_keywords),
    globalBlockedRegions: csvListToString(resolved.global_mode_blocked_regions),
    globalAllowedLocations: csvListToString(resolved.global_mode_allowed_locations),
  };
}

export function computeRelocationWeight(
  fields: Pick<SettingsFormFields, "skillWeight" | "recencyWeight">,
): number {
  return 100 - fields.skillWeight - fields.recencyWeight;
}

export type SettingsSaveResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

/** Builds the PATCH /api/settings body, or an error if the weights are invalid. */
export function buildSettingsPayload(fields: SettingsFormFields): SettingsSaveResult {
  const relocationWeight = computeRelocationWeight(fields);
  if (relocationWeight < 0) {
    return { ok: false, error: "Skill + recency weights cannot exceed 100%" };
  }

  const payload: Record<string, unknown> = {
    job_age_days: fields.jobAgeDays,
    pipeline_local: fields.pipelineLocal,
    pipeline_global: fields.pipelineGlobal,
    seniority_levels: Array.from(fields.seniorityLevels),
    junior_keywords: parseCsvList(fields.juniorKeywords),
    mid_keywords: parseCsvList(fields.midKeywords),
    senior_keywords: parseCsvList(fields.seniorKeywords),
    staff_keywords: parseCsvList(fields.staffKeywords),
    email_alerts_enabled: fields.emailAlerts,
    salary_reminder_enabled: fields.salaryReminders,
    expert_skills: parseCsvList(fields.expertSkills),
    secondary_skills: parseCsvList(fields.secondarySkills),
    gemini_filter_prompt: fields.geminiPrompt,
    scoring_weights: {
      skill: fields.skillWeight / 100,
      recency: fields.recencyWeight / 100,
      relocation: relocationWeight / 100,
    },
    excluded_keywords: parseCsvList(fields.excludedKeywords),
    blacklisted_locations: parseCsvList(fields.blacklistedLocations),
    required_keywords: parseCsvList(fields.requiredKeywords),
    global_mode_blocked_regions: parseCsvList(fields.globalBlockedRegions),
    global_mode_allowed_locations: parseCsvList(fields.globalAllowedLocations),
  };

  if (fields.clearGeminiKey) {
    payload.gemini_api_key = "";
  } else if (fields.geminiKey.trim()) {
    payload.gemini_api_key = fields.geminiKey.trim();
  }

  return { ok: true, payload };
}
