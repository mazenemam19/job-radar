// src/lib/__tests__/dashboard-route.test.ts
// Covers buildFeed() and enabledModes() extracted from GET /api/dashboard
// (audit row #18). Gemini is mocked; gate functions run from their real
// implementations so the pipeline integration is exercised end-to-end.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawJob, ResolvedSettings } from "../types";

// ── Mock Gemini (network call) ─────────────────────────────────
vi.mock("../gemini", () => ({
  filterJobsWithGeminiVerbose: vi.fn(),
}));

import { filterJobsWithGeminiVerbose } from "../gemini";
const mockGemini = filterJobsWithGeminiVerbose as ReturnType<typeof vi.fn>;

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

/** A passing verbose Gemini decision for the given job(s). */
function passingDecision(job: RawJob) {
  return { id: job.id, pass: true, reason: null, reviewed: true, quotaExhausted: false };
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
    const { finalJobs, gateLog } = await buildFeed([], settings, "key-abc");

    expect(finalJobs).toEqual([]);
    expect(gateLog.candidate_window).toBe(0);
    expect(gateLog.on_dashboard).toBe(0);
    expect(gateLog.gates.gemini.count).toBe(0);
    expect(gateLog.gates.scoring.count).toBe(0);
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

  it("calls the verbose Gemini variant when an API key is supplied", async () => {
    const job = makeJob({ title: "Senior React Engineer" });
    mockGemini.mockResolvedValue([passingDecision(job)]);

    const { finalJobs } = await buildFeed([job], settings, "user-api-key");

    expect(mockGemini).toHaveBeenCalledWith("user-api-key", [job], settings);
    expect(finalJobs.length).toBe(1);
    expect(finalJobs[0].gemini_reviewed).toBe(true);
  });

  it("filters out jobs older than job_age_days, attributing the drop to the date gate", async () => {
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
    const oldJob = makeJob({ posted_at: oldDate, fetched_at: oldDate, date_unknown: false });

    const { gateLog } = await buildFeed([oldJob], makeSettings({ job_age_days: 30 }), null);

    expect(gateLog.gates.date.count).toBe(1);
    expect(gateLog.gates.date.sample[0]).toMatchObject({ id: oldJob.id, title: oldJob.title });
    expect(gateLog.on_dashboard).toBe(0);
  });

  it("excludes jobs whose titles contain an excluded keyword, attributing the drop to that gate", async () => {
    const job = makeJob({ title: "Backend Engineer" });
    const settingsWithExclude = makeSettings({ excluded_keywords: ["Backend"] });

    const { gateLog } = await buildFeed([job], settingsWithExclude, null);

    expect(gateLog.gates.excluded_keywords.count).toBe(1);
    expect(gateLog.gates.excluded_keywords.sample[0].reason).toContain("Backend");
    // Never reaches later gates.
    expect(gateLog.gates.seniority.count).toBe(0);
  });

  it("gate breakdown counts are consistent with the final job list length", async () => {
    const job = makeJob({ title: "Senior React Engineer" });
    mockGemini.mockResolvedValue([passingDecision(job)]);

    const { finalJobs, gateLog } = await buildFeed([job], settings, "key");

    expect(gateLog.candidate_window).toBe(1);
    expect(gateLog.gates.date.count).toBe(0);
    expect(gateLog.gates.gemini.count).toBe(0);
    expect(gateLog.on_dashboard).toBe(finalJobs.length);
  });

  it("drops jobs with total_score ≤ 0 from the final feed, attributing it to the scoring gate (not Gemini)", async () => {
    // Zeroed scoring weights guarantee total_score = 0 regardless of how
    // well the job otherwise matches — deliberately not using a "zero
    // skill match" fixture here, since skill_match_score = 0 is
    // incompatible with passing the skill_match GATE (both derive from the
    // same underlying keyword match), so that scenario can't occur for a
    // job that reaches scoring at all.
    const matchingJob = makeJob({
      title: "Senior React Engineer",
      description: "We need React expertise",
    });
    const settingsZeroWeight = makeSettings({
      scoring_weights: { skill: 0, recency: 0, relocation: 0 },
    });
    mockGemini.mockResolvedValue([passingDecision(matchingJob)]);

    const { finalJobs, gateLog } = await buildFeed([matchingJob], settingsZeroWeight, "key");

    // Zero-weighted scoring → total_score = 0 → dropped
    expect(finalJobs).toHaveLength(0);
    // The job DID pass Gemini -- it's the scoring stage that drops it. If these
    // two numbers were still the same field (the old `after_gemini` bug), this
    // job's rejection would get silently attributed to "failed your Gemini
    // filter" when it never did.
    expect(gateLog.gates.gemini.count).toBe(0);
    expect(gateLog.gates.scoring.count).toBe(1);
    expect(gateLog.gates.scoring.sample[0].reason).toContain("final score");
    expect(gateLog.on_dashboard).toBe(0);
  });

  it("a fresh job survives even when scoring is weighted entirely toward recency", async () => {
    // Renamed from the old "zero skill match" framing: a job can't have
    // skill_match_score = 0 while also clearing the skill_match GATE (see
    // the note above), so this instead verifies the same underlying point —
    // total_score isn't purely a function of skill match — by zeroing the
    // skill weight directly rather than trying to zero the score itself.
    const recentJob = makeJob({
      title: "Senior React Engineer",
      description: "We need React expertise",
    });
    const settingsRecencyOnly = makeSettings({
      scoring_weights: { skill: 0, recency: 1, relocation: 0 },
    });
    mockGemini.mockResolvedValue([passingDecision(recentJob)]);

    const { finalJobs } = await buildFeed([recentJob], settingsRecencyOnly, "key");

    expect(finalJobs).toHaveLength(1);
    expect(finalJobs[0].recency_score).toBeGreaterThan(0);
    expect(finalJobs[0].total_score).toBeGreaterThan(0);
  });

  it("skips the global_mode gate entirely for local-mode jobs", async () => {
    const job = makeJob({ mode: "local", title: "Frontend Engineer (US Only)" });
    mockGemini.mockResolvedValue([passingDecision(job)]);

    const { gateLog } = await buildFeed([job], settings, "key");

    expect(gateLog.gates.global_mode.count).toBe(0);
  });

  it("caps each gate's sample at MAX_PIPELINE_SAMPLE while keeping the true count uncapped", async () => {
    const jobs = Array.from({ length: 60 }, (_, i) =>
      makeJob({ id: `job-${i}`, title: "Junior Developer" }),
    );
    const { gateLog } = await buildFeed([...jobs], settings, null);

    expect(gateLog.gates.seniority.count).toBe(60);
    expect(gateLog.gates.seniority.sample).toHaveLength(50);
  });
});
