// src/lib/__tests__/explain.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { explainJob } from "../explain";
import type { RawJob, ResolvedSettings } from "../types";

const NOW = new Date("2025-06-01T12:00:00Z").getTime();

function makeJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    id: "test-job-1",
    title: "Senior Frontend Engineer",
    company: "Acme Corp",
    location: "London, UK",
    country: "GB",
    country_flag: "🇬🇧",
    url: "https://jobs.example.com/1",
    description: "We need a React and TypeScript expert",
    posted_at: new Date(NOW - 86_400_000).toISOString(),
    fetched_at: new Date(NOW).toISOString(),
    date_unknown: false,
    is_remote: false,
    salary: null,
    mode: "local",
    visa_sponsorship: false,
    source_name: "Acme",
    ats_type: "greenhouse",
    created_at: new Date(NOW).toISOString(),
    ...overrides,
  };
}

const SETTINGS: ResolvedSettings = {
  expert_skills: ["React", "TypeScript"],
  secondary_skills: ["GraphQL"],
  bonus_skills: [],
  job_age_days: 7,
  pipeline_local: true,
  pipeline_global: true,
  junior_keywords: ["junior"],
  mid_keywords: ["mid-level"],
  senior_keywords: ["senior"],
  staff_keywords: ["staff"],
  seniority_levels: ["senior", "staff"],
  gemini_filter_prompt: "",
  scoring_weights: { skill: 0.6, recency: 0.3, relocation: 0.1 },
  score_denominator: 18,
  excluded_keywords: ["sales"],
  blacklisted_locations: ["israel"],
  required_keywords: [],
  global_mode_blocked_regions: ["us only"],
  global_mode_allowed_locations: ["remote", "worldwide"],
  email_alerts_enabled: true,
  salary_reminder_enabled: true,
};

const PASSING_GEMINI = { pass: true, reason: "Good fit", reviewed: true };

describe("explainJob — short-circuit ordering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops at the date gate and doesn't evaluate later gates", () => {
    const job = makeJob({ posted_at: new Date(NOW - 30 * 86_400_000).toISOString() });
    const result = explainJob(job, SETTINGS, null);

    expect(result.stoppedAt).toBe("date");
    expect(result.gates).toHaveLength(1);
    expect(result.gates[0].gate).toBe("date");
    expect(result.gates[0].pass).toBe(false);
    expect(result.finalScore).toBeNull();
  });

  it("stops at seniority when date passes but seniority fails", () => {
    const job = makeJob({ title: "Junior Frontend Developer" });
    const result = explainJob(job, SETTINGS, null);

    expect(result.stoppedAt).toBe("seniority");
    expect(result.gates.map((g) => g.gate)).toEqual(["date", "seniority"]);
  });

  it("stops at excluded_keywords", () => {
    const job = makeJob({ title: "Senior Sales Engineer" });
    const result = explainJob(job, SETTINGS, null);

    expect(result.stoppedAt).toBe("excluded_keywords");
    expect(result.gates.map((g) => g.gate)).toEqual(["date", "seniority", "excluded_keywords"]);
  });

  it("stops at blacklisted_locations", () => {
    const job = makeJob({ location: "Tel Aviv, Israel" });
    const result = explainJob(job, SETTINGS, null);

    expect(result.stoppedAt).toBe("blacklisted_locations");
  });

  it("stops at skill_match", () => {
    const job = makeJob({ description: "We use Angular and Svelte" });
    const settings = {
      ...SETTINGS,
      required_keywords: ["angular"],
      expert_skills: ["Vue"],
      secondary_skills: [],
    };
    const result = explainJob(job, settings, null);

    expect(result.stoppedAt).toBe("skill_match");
  });

  it("skips global_mode entirely for a local-mode job", () => {
    const job = makeJob({ mode: "local", title: "Frontend Engineer (US Only)" });
    const result = explainJob(job, SETTINGS, PASSING_GEMINI);

    expect(result.gates.map((g) => g.gate)).not.toContain("global_mode");
  });

  it("evaluates global_mode for a global-mode job and stops there on failure", () => {
    const job = makeJob({ mode: "global", title: "Frontend Engineer (US Only)" });
    const result = explainJob(job, SETTINGS, null);

    expect(result.stoppedAt).toBe("global_mode");
    expect(result.gates.map((g) => g.gate)).toEqual([
      "date",
      "seniority",
      "excluded_keywords",
      "required_keywords",
      "blacklisted_locations",
      "skill_match",
      "global_mode",
    ]);
  });
});

describe("explainJob — Gemini stage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns stoppedAt: null (incomplete trace) when every gate passes but no Gemini result was supplied", () => {
    const job = makeJob();
    const result = explainJob(job, SETTINGS, null);

    expect(result.stoppedAt).toBeNull();
    expect(result.gates.map((g) => g.gate)).not.toContain("gemini");
    expect(result.finalScore).toBeNull();
  });

  it("stops at gemini when the supplied decision failed", () => {
    const job = makeJob();
    const result = explainJob(job, SETTINGS, {
      pass: false,
      reason: "Not a fit per your prompt",
      reviewed: true,
    });

    expect(result.stoppedAt).toBe("gemini");
    const geminiOutcome = result.gates.find((g) => g.gate === "gemini");
    expect(geminiOutcome).toEqual({
      gate: "gemini",
      pass: false,
      reason: "Not a fit per your prompt",
    });
  });

  it("reaches scoring and reports finalScore when Gemini passes and the job scores above 0", () => {
    const job = makeJob({ description: "We need React and TypeScript expert" });
    const result = explainJob(job, SETTINGS, PASSING_GEMINI);

    expect(result.stoppedAt).toBeNull();
    expect(result.gates.map((g) => g.gate)).toContain("scoring");
    expect(result.finalScore).not.toBeNull();
    expect(result.finalScore).toBeGreaterThan(0);
  });

  it("stops at scoring when the job passes every gate but scores 0 or below", () => {
    // No skill match content at all beyond the boilerplate-window bar would
    // normally fail skill_match first — force a pass-everything-but-score-0
    // path via zeroed scoring weights instead.
    const job = makeJob();
    const settings = {
      ...SETTINGS,
      scoring_weights: { skill: 0, recency: 0, relocation: 0 },
    };
    const result = explainJob(job, settings, PASSING_GEMINI);

    expect(result.stoppedAt).toBe("scoring");
    expect(result.finalScore).toBe(0);
  });
});

describe("explainJob — reason is null on every passing gate", () => {
  it("never attaches a reason to a gate that passed", () => {
    const job = makeJob();
    const result = explainJob(job, SETTINGS, PASSING_GEMINI);

    for (const gate of result.gates) {
      if (gate.pass) {
        expect(gate.reason).toBeNull();
      }
    }
  });
});
