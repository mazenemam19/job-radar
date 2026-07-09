// src/lib/__tests__/scoring.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeRecencyScore,
  computeSkillMatchScore,
  passesSeniorityGate,
  passesDateGate,
  scoreJob,
  mergeJobs,
  passesSettingsGate,
  passesExcludedKeywordsGate,
  passesRequiredKeywordsGate,
  passesBlacklistedLocationsGate,
  passesSkillMatchGate,
  passesGlobalModeGate,
  getMatchedLevels,
  getDisplaySeniorityBadge,
  explainDateGate,
  explainSeniorityGate,
  explainExcludedKeywordsGate,
  explainRequiredKeywordsGate,
  explainBlacklistedLocationsGate,
  explainSkillMatchGate,
  explainGlobalModeGate,
} from "../scoring";
import type { RawJob, ResolvedSettings } from "../types";

// ── Fixtures ──────────────────────────────────────────────────

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

// ── computeRecencyScore ───────────────────────────────────────
// Recency is always computed live from job.posted_at, never cached.

describe("computeRecencyScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ~100 for a very recently posted job", () => {
    const recent = new Date(NOW - 3600_000).toISOString();
    expect(computeRecencyScore(recent)).toBeGreaterThanOrEqual(99);
  });

  it("returns exactly 0 for a job posted 7+ days ago", () => {
    const old = new Date(NOW - 8 * 86_400_000).toISOString();
    expect(computeRecencyScore(old)).toBe(0);
  });

  it("returns ~50 for a job posted 3.5 days ago", () => {
    const halfWay = new Date(NOW - 3.5 * 86_400_000).toISOString();
    const score = computeRecencyScore(halfWay);
    expect(score).toBeGreaterThanOrEqual(48);
    expect(score).toBeLessThanOrEqual(52);
  });

  it("returns 0 for an invalid date string", () => {
    expect(computeRecencyScore("not-a-date")).toBe(0);
  });

  it("is computed live at call time (calling twice at different times gives different results)", () => {
    const postedAt = new Date(NOW - 86_400_000).toISOString();
    const score1 = computeRecencyScore(postedAt);
    vi.setSystemTime(NOW + 7 * 86_400_000);
    const score2 = computeRecencyScore(postedAt);
    expect(score2).toBeLessThan(score1);
  });
});

// ── computeSkillMatchScore ────────────────────────────────────

describe("computeSkillMatchScore", () => {
  it("matches expert skills (×3 each)", () => {
    const desc = "Looking for React and TypeScript developer";
    const result = computeSkillMatchScore(desc, {
      expert_skills: ["React", "TypeScript"],
      secondary_skills: [],
      score_denominator: 6,
    });
    expect(result.score).toBe(100);
    expect(result.matched).toContain("React");
    expect(result.matched).toContain("TypeScript");
  });

  it("caps at 100 even if raw score exceeds denominator", () => {
    const desc = "React TypeScript JavaScript HTML CSS Redux expert";
    const result = computeSkillMatchScore(desc, {
      expert_skills: ["React", "TypeScript", "JavaScript", "HTML", "CSS", "Redux"],
      secondary_skills: [],
      score_denominator: 1,
    });
    expect(result.score).toBe(100);
  });

  it("is case-insensitive", () => {
    const desc = "REACT and typescript developer";
    const result = computeSkillMatchScore(desc, {
      expert_skills: ["React", "TypeScript"],
      secondary_skills: [],
      score_denominator: 6,
    });
    expect(result.score).toBe(100);
  });

  it("returns 0 when no skills matched", () => {
    const desc = "Python and Django backend developer";
    const result = computeSkillMatchScore(desc, {
      expert_skills: ["React", "TypeScript"],
      secondary_skills: ["Jest"],
      score_denominator: 18,
    });
    expect(result.score).toBe(0);
    expect(result.matched).toHaveLength(0);
  });

  it("secondary skills count ×1", () => {
    const desc = "We use Jest for testing";
    const result = computeSkillMatchScore(desc, {
      expert_skills: ["React"],
      secondary_skills: ["Jest"],
      score_denominator: 1,
    });
    expect(result.score).toBe(100);
    expect(result.matched).toContain("Jest");
  });
});

// ── getMatchedLevels (Tier 5c) ────────────────────────────────

describe("getMatchedLevels", () => {
  it("matches senior keywords", () => {
    const job = makeJob({ title: "Senior React Developer" });
    expect(getMatchedLevels(job, DEFAULT_SETTINGS)).toContain("senior");
  });

  it("matches staff+ keywords", () => {
    const job = makeJob({ title: "Staff Engineer" });
    expect(getMatchedLevels(job, DEFAULT_SETTINGS)).toContain("staff");
  });

  it("matches junior keywords", () => {
    const job = makeJob({ title: "Junior Frontend Developer" });
    expect(getMatchedLevels(job, DEFAULT_SETTINGS)).toContain("junior");
  });

  it("matches mid keywords", () => {
    const job = makeJob({ title: "Mid-level Frontend Developer" });
    expect(getMatchedLevels(job, DEFAULT_SETTINGS)).toContain("mid");
  });

  it("is multi-label: Senior Staff Engineer matches both", () => {
    const job = makeJob({ title: "Senior Staff Engineer" });
    const levels = getMatchedLevels(job, DEFAULT_SETTINGS);
    expect(levels).toContain("senior");
    expect(levels).toContain("staff");
  });

  it("returns empty array for unlabelled roles", () => {
    const job = makeJob({ title: "Frontend Engineer" });
    expect(getMatchedLevels(job, DEFAULT_SETTINGS)).toEqual([]);
  });

  it("respects custom keyword lists", () => {
    const settings: ResolvedSettings = {
      ...DEFAULT_SETTINGS,
      senior_keywords: ["lead", "principal"],
    };
    const job = makeJob({ title: "Lead Developer" });
    expect(getMatchedLevels(job, settings)).toContain("senior");
  });
});

// ── getDisplaySeniorityBadge (Tier 5c) ────────────────────────

describe("getDisplaySeniorityBadge", () => {
  it("returns null for unlabelled jobs", () => {
    const job = makeJob({ title: "Frontend Engineer" });
    expect(getDisplaySeniorityBadge(job, DEFAULT_SETTINGS)).toBeNull();
  });

  it("returns the single matched level", () => {
    const job = makeJob({ title: "Senior Developer" });
    expect(getDisplaySeniorityBadge(job, DEFAULT_SETTINGS)).toBe("senior");
  });

  it("returns highest of multiple matches (Staff > Senior)", () => {
    const job = makeJob({ title: "Senior Staff Engineer" });
    expect(getDisplaySeniorityBadge(job, DEFAULT_SETTINGS)).toBe("staff");
  });

  it("returns Mid when only mid matches", () => {
    const job = makeJob({ title: "Mid-level Developer" });
    expect(getDisplaySeniorityBadge(job, DEFAULT_SETTINGS)).toBe("mid");
  });

  it("returns Junior when only junior matches", () => {
    const job = makeJob({ title: "Junior Developer" });
    expect(getDisplaySeniorityBadge(job, DEFAULT_SETTINGS)).toBe("junior");
  });
});

// ── passesSeniorityGate (Tier 5c: multi-label set-overlap) ────

describe("passesSeniorityGate", () => {
  it("rejects junior roles when junior not in selected levels", () => {
    const job = makeJob({ title: "Junior Frontend Developer" });
    expect(passesSeniorityGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("accepts junior roles when junior IS selected", () => {
    const job = makeJob({ title: "Junior Frontend Developer" });
    const settings: ResolvedSettings = { ...DEFAULT_SETTINGS, seniority_levels: ["junior"] };
    expect(passesSeniorityGate(job, settings)).toBe(true);
  });

  it("accepts senior roles when senior is selected", () => {
    const job = makeJob({ title: "Senior React Developer" });
    expect(passesSeniorityGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("accepts staff roles when staff is selected", () => {
    const job = makeJob({ title: "Staff Engineer" });
    expect(passesSeniorityGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("rejects mid-level when only senior/staff selected", () => {
    const job = makeJob({ title: "Mid-level Frontend Developer" });
    expect(passesSeniorityGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("accepts mid-level when mid is selected", () => {
    const job = makeJob({ title: "Mid-level Frontend Developer" });
    const settings: ResolvedSettings = {
      ...DEFAULT_SETTINGS,
      seniority_levels: ["mid", "senior", "staff"],
    };
    expect(passesSeniorityGate(job, settings)).toBe(true);
  });

  it("passes through unlabelled roles (let Gemini decide)", () => {
    const job = makeJob({ title: "Frontend Engineer" });
    expect(passesSeniorityGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("a job matching both Senior and Staff passes for a user who selected either", () => {
    const job = makeJob({ title: "Senior Staff Engineer" });
    const seniorOnly: ResolvedSettings = { ...DEFAULT_SETTINGS, seniority_levels: ["senior"] };
    const staffOnly: ResolvedSettings = { ...DEFAULT_SETTINGS, seniority_levels: ["staff"] };
    expect(passesSeniorityGate(job, seniorOnly)).toBe(true);
    expect(passesSeniorityGate(job, staffOnly)).toBe(true);
  });
});

describe("explainSeniorityGate", () => {
  it("returns pass:true, reason:null for an unlabelled job", () => {
    const job = makeJob({ title: "Frontend Engineer" });
    expect(explainSeniorityGate(job, DEFAULT_SETTINGS)).toEqual({ pass: true, reason: null });
  });

  it("returns pass:true, reason:null when a matched level is enabled", () => {
    const job = makeJob({ title: "Senior React Developer" });
    expect(explainSeniorityGate(job, DEFAULT_SETTINGS)).toEqual({ pass: true, reason: null });
  });

  it("returns pass:false with matched/enabled levels in the reason on failure", () => {
    const job = makeJob({ title: "Junior Frontend Developer" });
    const result = explainSeniorityGate(job, DEFAULT_SETTINGS);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("junior");
    expect(result.reason).toContain("senior");
  });
});

// ── passesDateGate ───────────────────────────────────────────
// Date gate uses fetched_at as fallback when date_unknown = true.

describe("passesDateGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes a 3-day-old job within a 7-day window", () => {
    const job = makeJob({ posted_at: new Date(NOW - 3 * 86_400_000).toISOString() });
    expect(passesDateGate(job, 7)).toBe(true);
  });

  it("rejects a 10-day-old job within a 7-day window", () => {
    const job = makeJob({ posted_at: new Date(NOW - 10 * 86_400_000).toISOString() });
    expect(passesDateGate(job, 7)).toBe(false);
  });

  it("uses fetched_at when date_unknown = true", () => {
    const fetchedAt = new Date(NOW - 2 * 86_400_000).toISOString();
    const job = makeJob({
      posted_at: new Date(NOW).toISOString(),
      fetched_at: fetchedAt,
      date_unknown: true,
    });
    expect(passesDateGate(job, 7)).toBe(true);
  });

  it("date_unknown job expires based on fetched_at", () => {
    const fetchedAt = new Date(NOW - 10 * 86_400_000).toISOString();
    const job = makeJob({
      posted_at: new Date(NOW).toISOString(),
      fetched_at: fetchedAt,
      date_unknown: true,
    });
    expect(passesDateGate(job, 7)).toBe(false);
  });
});

describe("explainDateGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns pass:true, reason:null within the window", () => {
    const job = makeJob({ posted_at: new Date(NOW - 3 * 86_400_000).toISOString() });
    expect(explainDateGate(job, 7)).toEqual({ pass: true, reason: null });
  });

  it("returns pass:false with age and limit in the reason when too old", () => {
    const job = makeJob({ posted_at: new Date(NOW - 10 * 86_400_000).toISOString() });
    const result = explainDateGate(job, 7);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("10d");
    expect(result.reason).toContain("7d");
  });

  it("returns pass:false with an unparseable-date reason for a bad date string", () => {
    const job = makeJob({ posted_at: "not-a-date" });
    const result = explainDateGate(job, 7);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("could not be parsed");
  });
});

// ── scoreJob ─────────────────────────────────────────────────
// Skill match and recency are scored independently; recency is
// counted even when skill match is zero.

describe("scoreJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for junior role when junior not selected (hard seniority reject)", () => {
    const job = makeJob({ title: "Junior React Developer", description: "React TypeScript CSS" });
    expect(scoreJob(job, DEFAULT_SETTINGS)).toBeNull();
  });

  it("returns a scored job for a senior role with matching skills", () => {
    const job = makeJob({
      title: "Senior React Developer",
      description: "We need React and TypeScript expertise",
    });
    const result = scoreJob(job, DEFAULT_SETTINGS);
    expect(result).not.toBeNull();
    expect(result!.total_score).toBeGreaterThan(0);
    expect(result!.matched_skills).toContain("React");
    expect(result!.matched_skills).toContain("TypeScript");
  });

  it("recency_score is computed even when skill score is 0", () => {
    const job = makeJob({
      title: "Senior Developer",
      description: "Python Django backend only, no frontend skills mentioned",
    });
    const result = scoreJob(job, DEFAULT_SETTINGS);
    expect(result).not.toBeNull();
    expect(result!.recency_score).toBeGreaterThan(0);
    expect(result!.skill_match_score).toBe(0);
  });

  it("adds relocation_bonus for jobs with visa_sponsorship", () => {
    const job = makeJob({
      title: "Senior React Developer",
      description: "React TypeScript",
      visa_sponsorship: true,
    });
    const result = scoreJob(job, DEFAULT_SETTINGS);
    expect(result!.relocation_bonus).toBe(100);
  });

  it("passes gemini_pass and gemini_reason through", () => {
    const job = makeJob({ title: "Senior React Dev", description: "React TypeScript" });
    const result = scoreJob(job, DEFAULT_SETTINGS, true, "Matches senior React profile", true);
    expect(result!.gemini_pass).toBe(true);
    expect(result!.gemini_reason).toBe("Matches senior React profile");
    expect(result!.gemini_reviewed).toBe(true);
  });

  it("defaults gemini_reviewed to false when not passed", () => {
    const job = makeJob({ title: "Senior React Dev", description: "React TypeScript" });
    const result = scoreJob(job, DEFAULT_SETTINGS);
    expect(result!.gemini_reviewed).toBe(false);
  });

  it("passes gemini_quota_exhausted through, defaulting to false", () => {
    const job = makeJob({ title: "Senior React Dev", description: "React TypeScript" });
    expect(scoreJob(job, DEFAULT_SETTINGS)!.gemini_quota_exhausted).toBe(false);
    expect(
      scoreJob(job, DEFAULT_SETTINGS, true, "gemini-quota-exhausted", false, true)!
        .gemini_quota_exhausted,
    ).toBe(true);
  });
});

// ── mergeJobs ────────────────────────────────────────────────
// Merges old and new jobs, deduplicates by id (keeping fresher),
// and drops zero-score entries.

describe("mergeJobs", () => {
  function makeScoredJob(id: string, score: number, fetchedAt = NOW) {
    return {
      ...makeJob({ id, fetched_at: new Date(fetchedAt).toISOString() }),
      skill_match_score: score,
      recency_score: 80,
      relocation_bonus: 0,
      total_score: score,
      matched_skills: [],
      bonus_skills: [],
      gemini_pass: true,
      gemini_reason: null,
      gemini_reviewed: true,
    };
  }

  it("excludes jobs with total_score = 0", () => {
    const jobs = [makeScoredJob("a", 50), makeScoredJob("b", 0), makeScoredJob("c", 30)];
    const result = mergeJobs([], jobs);
    expect(result.map((j) => j.id)).not.toContain("b");
    expect(result).toHaveLength(2);
  });

  it("sorts by total_score descending", () => {
    const jobs = [makeScoredJob("a", 40), makeScoredJob("b", 80), makeScoredJob("c", 60)];
    const result = mergeJobs([], jobs);
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe("c");
    expect(result[2].id).toBe("a");
  });

  it("deduplicates by id, keeping fresher entry", () => {
    const older = makeScoredJob("dup", 70, NOW - 86_400_000);
    const newer = makeScoredJob("dup", 65, NOW);
    const result = mergeJobs([older], [newer]);
    expect(result).toHaveLength(1);
    expect(result[0].fetched_at).toBe(newer.fetched_at);
  });
});

// ── passesSettingsGate ───────────────────────────────────────

describe("passesSettingsGate", () => {
  it("passes a valid senior React developer job", () => {
    const job = makeJob({
      title: "Senior React Engineer",
      description: "Must know React and TypeScript. Full-time position.",
      location: "London, UK",
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("filters out junior jobs (not in selected levels)", () => {
    const job = makeJob({
      title: "Junior Frontend Engineer",
      description: "React and TS",
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("filters out backend roles", () => {
    const job = makeJob({
      title: "Backend Engineer (Go/Python)",
      description: "We use Go, Python, and PostgreSQL.",
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("filters out jobs lacking React/Next.js", () => {
    const job = makeJob({
      title: "Frontend Developer",
      description: "We use Vue.js and Angular.",
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("filters out geographically blacklisted jobs", () => {
    const job = makeJob({
      title: "Senior React Engineer",
      description: "US citizens only. Remote from US.",
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("filters out roles with citizenship/clearance requirements", () => {
    const job = makeJob({
      title: "React Developer",
      description: "Requires security clearance. No visa sponsorship.",
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("filters out roles with 0 matched skills", () => {
    const job = makeJob({
      title: "Frontend Engineer",
      description: "We use React and Webpack. But the user settings has no matching skills.",
    });
    const settings = {
      ...DEFAULT_SETTINGS,
      expert_skills: ["Angular", "Svelte"],
      secondary_skills: ["Vue"],
    };
    expect(passesSettingsGate(job, settings)).toBe(false);
  });
});

// ── passesSettingsGate sub-gates (audit row #12) ─────────────

describe("passesExcludedKeywordsGate", () => {
  it("passes when no excluded_keywords are set", () => {
    const job = makeJob({ title: "Senior React Engineer" });
    expect(passesExcludedKeywordsGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("fails when the title contains an excluded keyword", () => {
    const job = makeJob({ title: "Senior Sales Engineer" });
    const settings = { ...DEFAULT_SETTINGS, excluded_keywords: ["sales"] };
    expect(passesExcludedKeywordsGate(job, settings)).toBe(false);
  });
});

describe("passesRequiredKeywordsGate", () => {
  it("passes when required_keywords is empty and expert_skills matches", () => {
    const job = makeJob({ description: "We need React and TypeScript" });
    expect(passesRequiredKeywordsGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("fails when neither title, description, nor location match required_keywords", () => {
    const job = makeJob({ title: "Backend Engineer", description: "Go and Python" });
    const settings = { ...DEFAULT_SETTINGS, required_keywords: ["Rust"] };
    expect(passesRequiredKeywordsGate(job, settings)).toBe(false);
  });
});

describe("passesBlacklistedLocationsGate", () => {
  it("passes when no blacklisted_locations are set", () => {
    const job = makeJob({ location: "London, UK" });
    expect(passesBlacklistedLocationsGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("fails when the location matches a blacklisted term", () => {
    const job = makeJob({ location: "San Francisco, US" });
    const settings = { ...DEFAULT_SETTINGS, blacklisted_locations: ["US"] };
    expect(passesBlacklistedLocationsGate(job, settings)).toBe(false);
  });
});

describe("passesSkillMatchGate", () => {
  it("passes when the description matches an expert or secondary skill", () => {
    const job = makeJob({ description: "We use React heavily" });
    expect(passesSkillMatchGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("fails when the description matches none of the user's skills", () => {
    const job = makeJob({ description: "We use Angular and Svelte" });
    const settings = {
      ...DEFAULT_SETTINGS,
      expert_skills: ["Vue"],
      secondary_skills: ["Svelte-kit"],
    };
    expect(passesSkillMatchGate(job, settings)).toBe(false);
  });
});

// ── passesGlobalModeGate ─────────────────────────────────────

describe("passesGlobalModeGate", () => {
  it("allows a job with no blocked or allowed keywords", () => {
    const job = makeJob({
      title: "Frontend Engineer",
      description: "React + TypeScript",
      location: "Porto, Portugal",
    });
    expect(passesGlobalModeGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("blocks a job that mentions a blocked region keyword", () => {
    const job = makeJob({ title: "Frontend Engineer (US Only)", location: "New York" });
    expect(passesGlobalModeGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("always allows a job matching an allowed location keyword", () => {
    const job = makeJob({
      title: "Developer",
      description: "This is a worldwide remote role",
      location: "US Only",
    });
    expect(passesGlobalModeGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("uses word boundaries — 'us only' should not match 'usability'", () => {
    const job = makeJob({ title: "Developer", description: "Build great usability into products" });
    expect(passesGlobalModeGate(job, DEFAULT_SETTINGS)).toBe(true);
  });
});

// ── Explain variants ──────────────────────────────────────────
// These power the pipeline breakdown / job-trace search (explain.ts).
// Each must: match its passesXGate sibling's pass/fail, and return
// reason: null on pass (nothing downstream renders a reason for a survivor).

describe("explainExcludedKeywordsGate", () => {
  it("pass:true, reason:null when no excluded_keywords are set", () => {
    const job = makeJob({ title: "Senior React Engineer" });
    expect(explainExcludedKeywordsGate(job, DEFAULT_SETTINGS)).toEqual({
      pass: true,
      reason: null,
    });
  });

  it("names the matched excluded keyword on failure", () => {
    const job = makeJob({ title: "Senior Sales Engineer" });
    const settings = { ...DEFAULT_SETTINGS, excluded_keywords: ["sales"] };
    const result = explainExcludedKeywordsGate(job, settings);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("sales");
  });
});

describe("explainRequiredKeywordsGate", () => {
  it("pass:true, reason:null when expert_skills fallback matches", () => {
    const job = makeJob({ description: "We need React and TypeScript" });
    expect(explainRequiredKeywordsGate(job, DEFAULT_SETTINGS)).toEqual({
      pass: true,
      reason: null,
    });
  });

  it("lists the checked keyword set on failure", () => {
    const job = makeJob({ title: "Backend Engineer", description: "Go and Python" });
    const settings = { ...DEFAULT_SETTINGS, required_keywords: ["Rust"] };
    const result = explainRequiredKeywordsGate(job, settings);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("Rust");
  });
});

describe("explainBlacklistedLocationsGate", () => {
  it("pass:true, reason:null when no blacklisted_locations are set", () => {
    const job = makeJob({ location: "London, UK" });
    expect(explainBlacklistedLocationsGate(job, DEFAULT_SETTINGS)).toEqual({
      pass: true,
      reason: null,
    });
  });

  it("names the matched blacklisted term on failure", () => {
    const job = makeJob({ location: "San Francisco, US" });
    const settings = { ...DEFAULT_SETTINGS, blacklisted_locations: ["US"] };
    const result = explainBlacklistedLocationsGate(job, settings);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("US");
  });
});

describe("explainSkillMatchGate", () => {
  it("pass:true, reason:null when a skill matches", () => {
    const job = makeJob({ description: "We use React heavily" });
    expect(explainSkillMatchGate(job, DEFAULT_SETTINGS)).toEqual({ pass: true, reason: null });
  });

  it("returns a flat reason on failure (no single matched term to report)", () => {
    const job = makeJob({ description: "We use Angular and Svelte" });
    const settings = { ...DEFAULT_SETTINGS, expert_skills: ["Vue"], secondary_skills: [] };
    const result = explainSkillMatchGate(job, settings);
    expect(result.pass).toBe(false);
    expect(result.reason).toBe("no expert or secondary skill found in the job description");
  });
});

describe("explainGlobalModeGate", () => {
  it("pass:true, reason:null with no blocked or allowed keywords", () => {
    const job = makeJob({
      title: "Frontend Engineer",
      description: "React + TypeScript",
      location: "Porto, Portugal",
    });
    expect(explainGlobalModeGate(job, DEFAULT_SETTINGS)).toEqual({ pass: true, reason: null });
  });

  it("names the matched blocked region on failure", () => {
    const job = makeJob({ title: "Frontend Engineer (US Only)", location: "New York" });
    const result = explainGlobalModeGate(job, DEFAULT_SETTINGS);
    expect(result.pass).toBe(false);
    expect(result.reason).toContain("us only");
  });

  it("pass:true, reason:null when an allowed location short-circuits a blocked match", () => {
    const job = makeJob({
      title: "Developer",
      description: "This is a worldwide remote role",
      location: "US Only",
    });
    expect(explainGlobalModeGate(job, DEFAULT_SETTINGS)).toEqual({ pass: true, reason: null });
  });
});
