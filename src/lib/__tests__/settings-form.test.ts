// src/lib/__tests__/settings-form.test.ts
// Covers the pure transforms behind SettingsForm: CSV parsing, hydrating
// form state from a resolved settings object, and building the save payload
// (including the relocation-weight validation guard).

import { describe, it, expect } from "vitest";
import {
  parseCsvList,
  csvListToString,
  hydrateFormFields,
  computeRelocationWeight,
  buildSettingsPayload,
  DEFAULT_FORM_FIELDS,
} from "../settings-form";
import type { ResolvedSettings, SettingsFormFields } from "../types";

describe("parseCsvList", () => {
  it("splits, trims, and drops empties", () => {
    expect(parseCsvList("react,  node ,, next.js")).toEqual(["react", "node", "next.js"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseCsvList("")).toEqual([]);
    expect(parseCsvList("   ")).toEqual([]);
  });
});

describe("csvListToString", () => {
  it("joins with a comma-space", () => {
    expect(csvListToString(["react", "node"])).toBe("react, node");
  });

  it("treats null/undefined as empty", () => {
    expect(csvListToString(null)).toBe("");
    expect(csvListToString(undefined)).toBe("");
  });
});

const RESOLVED: ResolvedSettings = {
  expert_skills: ["react", "typescript"],
  secondary_skills: ["jest"],
  bonus_skills: [],
  job_age_days: 14,
  pipeline_local: false,
  pipeline_global: true,
  junior_keywords: ["intern"],
  mid_keywords: [],
  senior_keywords: ["senior"],
  staff_keywords: [],
  seniority_levels: ["mid"],
  gemini_filter_prompt: "filter for react roles",
  scoring_weights: { skill: 0.5, recency: 0.2, relocation: 0.3 },
  score_denominator: 1,
  excluded_keywords: ["devops"],
  blacklisted_locations: [],
  required_keywords: [],
  global_mode_blocked_regions: [],
  global_mode_allowed_locations: ["remote"],
  email_alerts_enabled: false,
  salary_reminder_enabled: true,
};

describe("hydrateFormFields", () => {
  it("maps resolved settings onto form field shape", () => {
    const fields = hydrateFormFields(RESOLVED);
    expect(fields.expertSkills).toBe("react, typescript");
    expect(fields.jobAgeDays).toBe(14);
    expect(fields.pipelineLocal).toBe(false);
    expect(fields.seniorityLevels).toEqual(new Set(["mid"]));
    expect(fields.skillWeight).toBe(50);
    expect(fields.recencyWeight).toBe(20);
    expect(fields.emailAlerts).toBe(false);
  });

  it("falls back to default seniority levels when the list is empty", () => {
    const fields = hydrateFormFields({ ...RESOLVED, seniority_levels: [] });
    expect(fields.seniorityLevels).toEqual(new Set(["senior", "staff"]));
  });
});

describe("computeRelocationWeight", () => {
  it("subtracts skill + recency from 100", () => {
    expect(computeRelocationWeight({ skillWeight: 60, recencyWeight: 30 })).toBe(10);
  });

  it("can go negative when the inputs over-allocate", () => {
    expect(computeRelocationWeight({ skillWeight: 70, recencyWeight: 50 })).toBe(-20);
  });
});

describe("buildSettingsPayload", () => {
  const baseFields: SettingsFormFields = {
    ...DEFAULT_FORM_FIELDS,
    excludedKeywords: "devops, backend",
    juniorKeywords: "intern, junior",
  };

  it("rejects when skill + recency weights exceed 100%", () => {
    const result = buildSettingsPayload({ ...baseFields, skillWeight: 70, recencyWeight: 50 });
    expect(result).toEqual({ ok: false, error: "Skill + recency weights cannot exceed 100%" });
  });

  it("splits comma lists and derives the relocation weight", () => {
    const result = buildSettingsPayload(baseFields);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.excluded_keywords).toEqual(["devops", "backend"]);
    expect(result.payload.junior_keywords).toEqual(["intern", "junior"]);
    expect(result.payload.scoring_weights).toEqual({ skill: 0.6, recency: 0.3, relocation: 0.1 });
  });

  it("omits gemini_api_key when no key was entered and clear wasn't requested", () => {
    const result = buildSettingsPayload(baseFields);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect("gemini_api_key" in result.payload).toBe(false);
  });

  it("sends an empty gemini_api_key when clearGeminiKey is set", () => {
    const result = buildSettingsPayload({ ...baseFields, clearGeminiKey: true, geminiKey: "abc" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.gemini_api_key).toBe("");
  });

  it("trims and sends a newly entered gemini key", () => {
    const result = buildSettingsPayload({ ...baseFields, geminiKey: "  new-key  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.gemini_api_key).toBe("new-key");
  });
});
