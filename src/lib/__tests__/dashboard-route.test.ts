// src/lib/__tests__/dashboard-route.test.ts
// Covers buildFeed() and enabledModes() extracted from GET /api/dashboard
// (audit row #18). Gemini is mocked; gate functions run from their real
// implementations so the pipeline integration is exercised end-to-end.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawJob, ResolvedSettings } from "../types";

// ── Mock Gemini (network call) ─────────────────────────────────
vi.mock("../gemini", () => ({
  filterJobsWithGemini: vi.fn(),
}));

import { filterJobsWithGemini } from "../gemini";
const mockGemini = filterJobsWithGemini as ReturnType<typeof vi.fn>;

import { buildFeed, enabledModes } from "../dashboard-route";

// ── Fixtures ──────────────────────────────────────────────────

function makeJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    id: "job-1",
    title: "Senior Frontend Engineer",
    company: "Acme",
    location: "London, UK",
    country: "GB",
    country_flag: "🇬🇧",
    url: "https://example.com/job/1",
    description: "We need React and TypeScript skills",
    posted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    date_unknown: false,
    is_remote: true,
    salary: null,
    mode: "global",
    visa_sponsorship: false,
    source_name: "Acme",
    ats_type: "greenhouse",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeSettings(overrides: Partial<ResolvedSettings> = {}): ResolvedSettings {
  return {
    expert_skills: ["React", "TypeScript"],
    secondary_skills: [],
    bonus_skills: [],
    job_age_days: 30,
    pipeline_local: true,
    pipeline_global: true,
    seniority_levels: ["senior"],
    junior_keywords: ["junior", "entry"],
    mid_keywords: ["mid", "intermediate"],
    senior_keywords: ["senior", "lead"],
    staff_keywords: ["staff", "principal"],
    excluded_keywords: [],
    required_keywords: [],
    blacklisted_locations: [],
    gemini_filter_prompt: null,
    scoring_weights: { skill: 0.5, recency: 0.3, relocation: 0.2 },
    score_denominator: 10,
    global_mode_blocked_regions: [],
    global_mode_allowed_locations: [],
    email_alerts_enabled: true,
    salary_reminder_enabled: false,
    uses_defaults: true,
    ...overrides,
  } as ResolvedSettings;
}

// ── enabledModes ──────────────────────────────────────────────

describe("enabledModes", () => {
  it("returns both modes when both pipelines are enabled", () => {
    expect(enabledModes(makeSettings({ pipeline_local: true, pipeline_global: true }))).toEqual([
      "local",
      "global",
    ]);
  });

  it("returns only local when global is disabled", () => {
    expect(enabledModes(makeSettings({ pipeline_local: true, pipeline_global: false }))).toEqual([
      "local",
    ]);
  });

  it("returns an empty array when both pipelines are disabled", () => {
    expect(enabledModes(makeSettings({ pipeline_local: false, pipeline_global: false }))).toEqual(
      [],
    );
  });
});

// ── buildFeed ─────────────────────────────────────────────────

describe("buildFeed", () => {
  const settings = makeSettings();

  beforeEach(() => {
    mockGemini.mockReset();
  });

  it("returns an empty feed when no raw jobs are provided", async () => {
    mockGemini.mockResolvedValue([]);
    const { finalJobs, pipelineLog } = await buildFeed([], settings, "key-abc");

    expect(finalJobs).toEqual([]);
    expect(pipelineLog.total_fetched).toBe(0);
    expect(pipelineLog.after_gemini_filter).toBe(0);
    expect(pipelineLog.after_scoring).toBe(0);
  });

  it("skips Gemini and marks jobs not-reviewed when no API key is given", async () => {
    const job = makeJob({ title: "Senior React Engineer" });
    const { finalJobs } = await buildFeed([job], settings, null);

    // Gemini must not be called
    expect(mockGemini).not.toHaveBeenCalled();
    // The job should still be scored and appear in the feed (gemini_pass = true, fail-open)
    expect(finalJobs.length).toBe(1);
    expect(finalJobs[0].gemini_reviewed).toBe(false);
  });

  it("calls Gemini when an API key is supplied", async () => {
    const job = makeJob({ title: "Senior React Engineer" });
    // Gemini marks the job as passing
    mockGemini.mockResolvedValue([
      {
        ...job,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: true,
        gemini_quota_exhausted: false,
      },
    ]);

    const { finalJobs } = await buildFeed([job], settings, "user-api-key");

    expect(mockGemini).toHaveBeenCalledWith("user-api-key", [job], settings);
    expect(finalJobs.length).toBe(1);
    expect(finalJobs[0].gemini_reviewed).toBe(true);
  });

  it("filters out jobs older than job_age_days", async () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
    const oldJob = makeJob({ posted_at: oldDate, fetched_at: oldDate, date_unknown: false });

    const { pipelineLog } = await buildFeed([oldJob], makeSettings({ job_age_days: 30 }), null);

    expect(pipelineLog.after_date_filter).toBe(0);
    expect(pipelineLog.after_scoring).toBe(0);
  });

  it("excludes jobs whose titles contain an excluded keyword", async () => {
    const job = makeJob({ title: "Junior React Developer" });
    const settingsWithExclude = makeSettings({ excluded_keywords: ["Junior"] });

    const { pipelineLog } = await buildFeed([job], settingsWithExclude, null);

    expect(pipelineLog.after_settings_filter).toBe(0);
  });

  it("pipeline log counts are consistent with final job list length", async () => {
    const job = makeJob({ title: "Senior React Engineer" });
    mockGemini.mockResolvedValue([
      {
        ...job,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: true,
        gemini_quota_exhausted: false,
      },
    ]);

    const { finalJobs, pipelineLog } = await buildFeed([job], settings, "key");

    expect(pipelineLog.total_fetched).toBe(1);
    expect(pipelineLog.after_date_filter).toBe(1);
    expect(pipelineLog.after_settings_filter).toBe(1);
    expect(pipelineLog.after_gemini_filter).toBe(1);
    expect(pipelineLog.after_scoring).toBe(finalJobs.length);
  });

  it("drops jobs with total_score ≤ 0 from the final feed", async () => {
    // A job that is both very old (recency_score = 0) and has no skill matches
    // (skill_match_score = 0) will have total_score = 0 and must be dropped.
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(); // 120 days ago
    const staleZeroSkillJob = makeJob({
      title: "COBOL Programmer",
      description: "Needs COBOL experience only",
      posted_at: oldDate,
      fetched_at: oldDate,
      date_unknown: false,
    });
    // job_age_days is 365 so the job passes the date gate, but its score will be 0
    const settingsWideAge = makeSettings({
      job_age_days: 365,
      required_keywords: [],
      expert_skills: ["React"], // no match against COBOL description
    });
    mockGemini.mockResolvedValue([
      {
        ...staleZeroSkillJob,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: true,
        gemini_quota_exhausted: false,
      },
    ]);

    const { finalJobs, pipelineLog } = await buildFeed([staleZeroSkillJob], settingsWideAge, "key");

    // Both skill_match_score and recency_score are 0 → total_score = 0 → dropped
    expect(finalJobs).toHaveLength(0);
    // The job DID pass Gemini -- it's the scoring stage that drops it. If these
    // two numbers were still the same field (the old `after_gemini` bug), this
    // job's rejection would get silently attributed to "failed your Gemini
    // filter" when it never did.
    expect(pipelineLog.after_gemini_filter).toBe(1);
    expect(pipelineLog.after_scoring).toBe(0);
  });

  it("keeps a recent job with zero skill match (non-zero recency keeps total_score > 0)", async () => {
    const recentZeroSkillJob = makeJob({
      title: "COBOL Programmer",
      description: "Needs COBOL experience only",
    });
    const settingsNoMatch = makeSettings({ required_keywords: [], expert_skills: ["React"] });
    mockGemini.mockResolvedValue([
      {
        ...recentZeroSkillJob,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: true,
        gemini_quota_exhausted: false,
      },
    ]);

    const { finalJobs } = await buildFeed([recentZeroSkillJob], settingsNoMatch, "key");

    // skill_match_score = 0 but recency_score is high (job is from today)
    // → total_score > 0 → job survives
    expect(finalJobs).toHaveLength(1);
    expect(finalJobs[0].recency_score).toBeGreaterThan(0);
    expect(finalJobs[0].total_score).toBeGreaterThan(0);
  });
});
