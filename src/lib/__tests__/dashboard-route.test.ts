// src/lib/__tests__/dashboard-route.test.ts
// Covers buildFeed() and enabledModes() extracted from GET /api/dashboard
// (audit row #18). Gemini is mocked; gate functions run from their real
// implementations so the pipeline integration is exercised end-to-end.
//
// Date, seniority, excluded-keywords, blacklisted-locations, and global-mode
// filtering moved to the DB level (jr_get_filtered_raw_jobs(), see
// raw-jobs-query.ts and docs/plans/2026-07-11-db-level-job-filtering.md).
// buildFeed() no longer applies those gates itself, so tests that exercised
// them here were removed -- that coverage already lives in scoring.test.ts's
// own passesDateGate/passesExcludedKeywordsGate/etc. describe() blocks, which
// test those gate functions directly and are unaffected by this refactor.

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

/** dbFunnelCounts fixture -- defaults to matching the input array length, but
 *  tests that need to prove the pass-through contract override it explicitly. */
function makeDbFunnel(
  overrides: Partial<{ total_fetched: number; after_date_filter: number }> = {},
) {
  return { total_fetched: 0, after_date_filter: 0, ...overrides };
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
    const { finalJobs, pipelineLog } = await buildFeed([], makeDbFunnel(), settings, "key-abc");

    expect(finalJobs).toEqual([]);
    expect(pipelineLog.total_fetched).toBe(0);
    expect(pipelineLog.after_gemini_filter).toBe(0);
    expect(pipelineLog.after_scoring).toBe(0);
  });

  it("skips Gemini and marks jobs not-reviewed when no API key is given", async () => {
    const job = makeJob({ title: "Senior React Engineer" });
    const { finalJobs } = await buildFeed(
      [job],
      makeDbFunnel({ total_fetched: 1, after_date_filter: 1 }),
      settings,
      null,
    );

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

    const { finalJobs } = await buildFeed(
      [job],
      makeDbFunnel({ total_fetched: 1, after_date_filter: 1 }),
      settings,
      "user-api-key",
    );

    expect(mockGemini).toHaveBeenCalledWith("user-api-key", [job], settings);
    expect(finalJobs.length).toBe(1);
    expect(finalJobs[0].gemini_reviewed).toBe(true);
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

    const { finalJobs, pipelineLog } = await buildFeed(
      [job],
      makeDbFunnel({ total_fetched: 1, after_date_filter: 1 }),
      settings,
      "key",
    );

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

    const { finalJobs, pipelineLog } = await buildFeed(
      [staleZeroSkillJob],
      makeDbFunnel({ total_fetched: 1, after_date_filter: 1 }),
      settingsWideAge,
      "key",
    );

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

    const { finalJobs } = await buildFeed(
      [recentZeroSkillJob],
      makeDbFunnel({ total_fetched: 1, after_date_filter: 1 }),
      settingsNoMatch,
      "key",
    );

    // skill_match_score = 0 but recency_score is high (job is from today)
    // → total_score > 0 → job survives
    expect(finalJobs).toHaveLength(1);
    expect(finalJobs[0].recency_score).toBeGreaterThan(0);
    expect(finalJobs[0].total_score).toBeGreaterThan(0);
  });
});

// These two are a separate top-level suite (rather than nested inside
// "buildFeed") because they test buildFeed's new contract specifically
// (pre-filtered input + explicit funnel counts), not the pipeline stages
// buildFeed still owns end-to-end -- and to keep the "buildFeed" describe's
// arrow function under the project's max-lines-per-function lint limit.
describe("buildFeed - DB-prefiltered input contract", () => {
  const settings = makeSettings();

  beforeEach(() => {
    mockGemini.mockReset();
  });

  it("passes total_fetched/after_date_filter through from dbFunnelCounts unchanged, not derived from the array", async () => {
    // Deliberately different from rawJobs.length (1) -- proves buildFeed no
    // longer computes these itself, since it never sees the unfiltered pool.
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

    const { pipelineLog } = await buildFeed(
      [job],
      makeDbFunnel({ total_fetched: 500, after_date_filter: 42 }),
      settings,
      "key",
    );

    expect(pipelineLog.total_fetched).toBe(500);
    expect(pipelineLog.after_date_filter).toBe(42);
  });

  it("rejects a job that coarse-passes required-keywords but fails the exact precision recheck", async () => {
    // "react" appears exactly once, within the first 600 characters (the
    // boilerplate window hasMeaningfulKeywordMatch ignores unless a second
    // distinct keyword also matches, or a match lands past the window). A
    // coarse "does react appear anywhere" SQL prefilter would pass this job
    // through; buildFeed's exact recheck must still reject it.
    const longDescription = "React " + "filler ".repeat(100);
    const job = makeJob({
      title: "Senior Frontend Engineer", // no "react" here, keeps the match count at exactly one
      description: longDescription,
    });
    const settingsWithRequired = makeSettings({
      required_keywords: ["react"],
      // "filler" recurs throughout the string, including past the 600-char
      // window, so skill-match passes easily -- isolating the rejection to
      // the required-keywords precision check specifically.
      expert_skills: ["filler"],
      secondary_skills: [],
    });

    const { finalJobs, pipelineLog } = await buildFeed(
      [job],
      makeDbFunnel({ total_fetched: 1, after_date_filter: 1 }),
      settingsWithRequired,
      null,
    );

    expect(finalJobs).toHaveLength(0);
    expect(pipelineLog.after_settings_filter).toBe(0);
  });
});
