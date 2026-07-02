// src/lib/__tests__/defaults-form.test.ts
// Covers the pure transforms behind DefaultsForm: hydrating form state from
// a fetched DefaultSettings object, and building the save payload.

import { describe, it, expect } from "vitest";
import { DEFAULT_FORM_FIELDS, hydrateFormFields, buildDefaultsPayload } from "../defaults-form";
import type { DefaultSettings } from "../types";

const DEFAULTS: DefaultSettings = {
  id: 1,
  expert_skills: ["react", "typescript"],
  secondary_skills: ["jest"],
  bonus_skills: [],
  job_age_days: 14,
  pipeline_local: true,
  pipeline_global: true,
  junior_keywords: ["intern"],
  mid_keywords: [],
  senior_keywords: ["senior"],
  staff_keywords: [],
  seniority_levels: ["senior", "staff"],
  gemini_filter_prompt: "filter for react roles",
  scoring_weights: { skill: 0.6, recency: 0.3, relocation: 0.1 },
  score_denominator: 24,
  excluded_keywords: ["devops"],
  blacklisted_locations: [],
  required_keywords: [],
  global_mode_blocked_regions: [],
  global_mode_allowed_locations: ["remote"],
  email_alerts_enabled: true,
  salary_reminder_enabled: true,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("hydrateFormFields", () => {
  it("maps a DefaultSettings row onto the form field shape", () => {
    const fields = hydrateFormFields(DEFAULTS);
    expect(fields.expertSkills).toBe("react, typescript");
    expect(fields.secondarySkills).toBe("jest");
    expect(fields.jobAgeDays).toBe(14);
    expect(fields.geminiPrompt).toBe("filter for react roles");
    expect(fields.seniorityLevels).toBe("senior, staff");
    expect(fields.excludedKeywords).toBe("devops");
    expect(fields.globalAllowedLocations).toBe("remote");
    expect(fields.scoreDenominator).toBe(24);
  });

  it("falls back to defaults when optional fields are null", () => {
    const fields = hydrateFormFields({
      ...DEFAULTS,
      gemini_filter_prompt: null,
      job_age_days: null as unknown as number,
      score_denominator: null as unknown as number,
    });
    expect(fields.geminiPrompt).toBe("");
    expect(fields.jobAgeDays).toBe(7);
    expect(fields.scoreDenominator).toBe(18);
  });

  it("treats empty arrays as empty strings, not blank placeholders", () => {
    const fields = hydrateFormFields(DEFAULTS);
    expect(fields.midKeywords).toBe("");
    expect(fields.blacklistedLocations).toBe("");
  });
});

describe("buildDefaultsPayload", () => {
  it("splits CSV fields back into arrays and carries numeric/string fields through", () => {
    const payload = buildDefaultsPayload({
      ...DEFAULT_FORM_FIELDS,
      expertSkills: "react,  node ,, next.js",
      jobAgeDays: 21,
      geminiPrompt: "custom prompt",
      seniorityLevels: "mid, senior",
      scoreDenominator: 30,
    });

    expect(payload.expert_skills).toEqual(["react", "node", "next.js"]);
    expect(payload.job_age_days).toBe(21);
    expect(payload.gemini_filter_prompt).toBe("custom prompt");
    expect(payload.seniority_levels).toEqual(["mid", "senior"]);
    expect(payload.score_denominator).toBe(30);
  });

  it("omits fields the form doesn't expose (pipeline flags, scoring weights, toggles)", () => {
    const payload = buildDefaultsPayload(DEFAULT_FORM_FIELDS);
    expect(payload).not.toHaveProperty("pipeline_local");
    expect(payload).not.toHaveProperty("pipeline_global");
    expect(payload).not.toHaveProperty("scoring_weights");
    expect(payload).not.toHaveProperty("bonus_skills");
    expect(payload).not.toHaveProperty("email_alerts_enabled");
    expect(payload).not.toHaveProperty("salary_reminder_enabled");
  });

  it("produces empty arrays for blank CSV fields", () => {
    const payload = buildDefaultsPayload(DEFAULT_FORM_FIELDS);
    expect(payload.excluded_keywords).toEqual([]);
    expect(payload.junior_keywords).toEqual([]);
  });
});
