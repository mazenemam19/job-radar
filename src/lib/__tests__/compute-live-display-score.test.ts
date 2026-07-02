// src/lib/__tests__/compute-live-display-score.test.ts
// Kept separate from scoring.test.ts (already over the file-size lint rule —
// see docs/AUDIT_STATUS.md) instead of growing that file further.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { computeLiveDisplayScore, computeRecencyScore, scoreJob } from "../scoring";
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
    mode: "global",
    visa_sponsorship: false,
    source_name: "Acme",
    ats_type: "greenhouse",
    created_at: new Date(NOW).toISOString(),
    ...overrides,
  };
}

const DEFAULT_SETTINGS: ResolvedSettings = {
  expert_skills: ["React", "TypeScript", "JavaScript", "CSS"],
  secondary_skills: ["Jest", "GraphQL"],
  bonus_skills: ["Node.js"],
  job_age_days: 7,
  pipeline_local: true,
  pipeline_global: true,
  junior_keywords: ["junior", "jr", "entry-level", "entry level", "intern", "graduate"],
  mid_keywords: ["mid-level", "mid level", "mid-senior", "intermediate"],
  senior_keywords: ["senior", "sr", "lead"],
  staff_keywords: ["staff", "principal", "architect", "director", "vp", "head"],
  seniority_levels: ["senior", "staff"],
  gemini_filter_prompt: "",
  scoring_weights: { skill: 0.6, recency: 0.3, relocation: 0.1 },
  score_denominator: 18,
  excluded_keywords: ["backend", "fullstack", "devops", "sre", "sysadmin", "hr", "marketing"],
  blacklisted_locations: [
    "israel",
    "tel aviv",
    "us only",
    "security clearance required",
    "no visa sponsorship",
  ],
  required_keywords: ["react", "next.js", "react native"],
  global_mode_blocked_regions: ["us only", "usa only", "pst", "est", "remote us"],
  global_mode_allowed_locations: ["remote", "worldwide", "anywhere", "emea", "europe", "global"],
  email_alerts_enabled: true,
  salary_reminder_enabled: true,
};

function baseDisplayJob() {
  return {
    posted_at: new Date(NOW - 86_400_000).toISOString(),
    fetched_at: new Date(NOW).toISOString(),
    date_unknown: false,
    skill_match_score: 80,
    relocation_bonus: 0,
    scoring_weights: undefined as
      | { skill: number; recency: number; relocation: number }
      | undefined,
  };
}
function makeDisplayJob(overrides: Partial<ReturnType<typeof baseDisplayJob>> = {}) {
  return { ...baseDisplayJob(), ...overrides };
}

describe("computeLiveDisplayScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches scoreJob's total_score for the same inputs", () => {
    const rawJob = makeJob({
      title: "Senior React Developer",
      description: "React TypeScript",
      posted_at: new Date(NOW - 86_400_000).toISOString(),
    });
    const scored = scoreJob(rawJob, DEFAULT_SETTINGS)!;
    const live = computeLiveDisplayScore(scored);
    expect(live.totalScore).toBe(scored.total_score);
    expect(live.recencyScore).toBe(scored.recency_score);
  });

  it("uses fetched_at for recency when date_unknown = true", () => {
    const job = makeDisplayJob({
      date_unknown: true,
      fetched_at: new Date(NOW - 7 * 86_400_000).toISOString(),
      posted_at: new Date(NOW).toISOString(), // would be "fresh" if wrongly used
    });
    const { recencyScore } = computeLiveDisplayScore(job);
    expect(recencyScore).toBe(computeRecencyScore(job.fetched_at));
  });

  it("falls back to default weights (0.6/0.3/0.1) when scoring_weights is absent", () => {
    const job = makeDisplayJob({ skill_match_score: 100, relocation_bonus: 100 });
    const { recencyScore, totalScore } = computeLiveDisplayScore(job);
    expect(totalScore).toBe(Math.round(100 * 0.6 + recencyScore * 0.3 + 100 * 0.1));
  });

  it("uses the job's own scoring_weights when present", () => {
    const job = makeDisplayJob({
      skill_match_score: 100,
      relocation_bonus: 0,
      scoring_weights: { skill: 1, recency: 0, relocation: 0 },
    });
    const { totalScore } = computeLiveDisplayScore(job);
    expect(totalScore).toBe(100);
  });
});
