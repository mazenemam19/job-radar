// src/lib/__tests__/scoring.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computeRecencyScore,
  computeSkillMatchScore,
  passesSeniorityGate,
  passesDateGate,
  scoreJob,
  mergeJobs,
  STAFF_KEYWORDS,
  passesSettingsGate,
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
    posted_at: new Date(NOW - 86_400_000).toISOString(), // 1 day ago
    fetched_at: new Date(NOW).toISOString(),
    date_unknown: false,
    is_remote: false,
    salary: null,
    mode: "visa",
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
  pipeline_visa: true,
  pipeline_local: true,
  pipeline_global: true,
  seniority_allow_mid: false,
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
  email_alerts_enabled: true,
};

// ── STAFF_KEYWORDS regex (Bug fix: word boundaries on ALL terms) ────

describe("STAFF_KEYWORDS regex", () => {
  // The old regex was /\blead|staff|principal|architect|director|vp|head\b/i
  // which meant "lead" had a left boundary but no right boundary,
  // and "head" had a right boundary but no left boundary.
  // Fixed: /\b(lead|staff|principal|architect|director|vp|head)\b/i

  it('matches standalone "lead"', () => {
    expect(STAFF_KEYWORDS.test("Team lead position")).toBe(true);
  });

  it('does NOT match "leads" (old bug: old regex WOULD match "leads")', () => {
    // Old pattern: /\blead|staff|.../ would match "lead" inside "leads"
    // New pattern: /\b(lead|...)\b/ correctly requires word boundary on both sides
    expect(STAFF_KEYWORDS.test("She leads the team")).toBe(false);
  });

  it('does NOT match "mislead"', () => {
    expect(STAFF_KEYWORDS.test("Do not mislead")).toBe(false);
  });

  it('matches standalone "head"', () => {
    expect(STAFF_KEYWORDS.test("Head of Engineering")).toBe(true);
  });

  it('does NOT match "headless" (old bug: old regex WOULD match "headless")', () => {
    // Old pattern: /...head\b/ has no left boundary, so "headless" would match
    // because "head" is at the start with no boundary needed on the left
    expect(STAFF_KEYWORDS.test("Headless CMS experience")).toBe(false);
  });

  it('matches "staff" as a standalone word', () => {
    expect(STAFF_KEYWORDS.test("Staff Engineer role")).toBe(true);
  });

  it('matches "vp" (VP of Engineering)', () => {
    expect(STAFF_KEYWORDS.test("VP of Product")).toBe(true);
  });

  it('matches "principal"', () => {
    expect(STAFF_KEYWORDS.test("Principal Software Engineer")).toBe(true);
  });
});

// ── computeRecencyScore (FIX #3) ──────────────────────────────

describe("computeRecencyScore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns ~100 for a very recently posted job", () => {
    const recent = new Date(NOW - 3600_000).toISOString(); // 1 hour ago
    expect(computeRecencyScore(recent)).toBeGreaterThanOrEqual(99);
  });

  it("returns exactly 0 for a job posted 7+ days ago", () => {
    const old = new Date(NOW - 8 * 86_400_000).toISOString(); // 8 days ago — past the 7-day horizon
    expect(computeRecencyScore(old)).toBe(0);
  });

  it("returns ~50 for a job posted 3.5 days ago (half the 7-day horizon)", () => {
    const halfWay = new Date(NOW - 3.5 * 86_400_000).toISOString(); // 3.5 days ago
    const score = computeRecencyScore(halfWay);
    expect(score).toBeGreaterThanOrEqual(48);
    expect(score).toBeLessThanOrEqual(52);
  });

  it("returns 0 for an invalid date string", () => {
    expect(computeRecencyScore("not-a-date")).toBe(0);
  });

  it("FIX #3: is always computed live (calling twice at different times gives different results)", () => {
    const postedAt = new Date(NOW - 86_400_000).toISOString(); // 1 day ago
    const score1 = computeRecencyScore(postedAt);

    // Advance time by 1 week
    vi.setSystemTime(NOW + 7 * 86_400_000);
    const score2 = computeRecencyScore(postedAt);

    expect(score2).toBeLessThan(score1); // score degrades with time
  });
});

// ── computeSkillMatchScore ────────────────────────────────────

describe("computeSkillMatchScore", () => {
  it("matches expert skills (×3 each)", () => {
    const desc = "Looking for React and TypeScript developer";
    const result = computeSkillMatchScore(desc, {
      expert_skills: ["React", "TypeScript"],
      secondary_skills: [],
      score_denominator: 6, // 2 expert × 3 = 6 = 100%
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
      score_denominator: 1, // absurdly low
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
      expert_skills: ["React"], // not matched
      secondary_skills: ["Jest"],
      score_denominator: 1, // 1 point for Jest
    });
    expect(result.score).toBe(100);
    expect(result.matched).toContain("Jest");
  });
});

// ── passesSeniorityGate ───────────────────────────────────────

describe("passesSeniorityGate", () => {
  it("rejects junior roles when allowMid = false", () => {
    const job = makeJob({ title: "Junior Frontend Developer" });
    expect(passesSeniorityGate(job, false)).toBe(false);
  });

  it("rejects intern roles", () => {
    const job = makeJob({ title: "Frontend Intern" });
    expect(passesSeniorityGate(job, false)).toBe(false);
  });

  it("accepts senior roles", () => {
    const job = makeJob({ title: "Senior React Developer" });
    expect(passesSeniorityGate(job, false)).toBe(true);
  });

  it("accepts staff/lead roles as senior-equivalent", () => {
    const job = makeJob({ title: "Staff Engineer" });
    expect(passesSeniorityGate(job, false)).toBe(true);
  });

  it("rejects mid-level when allowMid = false", () => {
    const job = makeJob({ title: "Mid-level Frontend Developer" });
    expect(passesSeniorityGate(job, false)).toBe(false);
  });

  it("accepts mid-senior when allowMid = true", () => {
    const job = makeJob({ title: "Mid-Senior Frontend Engineer" });
    expect(passesSeniorityGate(job, true)).toBe(true);
  });

  it("passes through unlabelled roles (let Gemini decide)", () => {
    const job = makeJob({ title: "Frontend Engineer" });
    expect(passesSeniorityGate(job, false)).toBe(true);
  });
});

// ── passesDateGate (FIX #5) ───────────────────────────────────

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

  it("FIX #5: uses fetched_at when date_unknown = true", () => {
    // date_unknown job: posted_at is set to "now" by the old parseRelativeDate bug.
    // new code uses fetched_at for the gate, which is the actual fetch time.
    const fetchedAt = new Date(NOW - 2 * 86_400_000).toISOString(); // 2 days ago
    const job = makeJob({
      posted_at: new Date(NOW).toISOString(), // "now" — the buggy value from parseRelativeDate
      fetched_at: fetchedAt,
      date_unknown: true,
    });
    // Should use fetched_at (2 days ago) → passes 7-day window
    expect(passesDateGate(job, 7)).toBe(true);
  });

  it("FIX #5: date_unknown job expires based on fetched_at, not posted_at", () => {
    // If fetched_at is old but posted_at is "now" (the buggy immortal value)
    const fetchedAt = new Date(NOW - 10 * 86_400_000).toISOString(); // 10 days ago
    const job = makeJob({
      posted_at: new Date(NOW).toISOString(), // "now" — would pass without fix
      fetched_at: fetchedAt,
      date_unknown: true,
    });
    // Without fix: would use posted_at (now) → passes forever (bug)
    // With fix:    uses fetched_at (10 days ago) → correctly rejected
    expect(passesDateGate(job, 7)).toBe(false);
  });
});

// ── scoreJob (FIX #6) ────────────────────────────────────────

describe("scoreJob", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for junior role (hard seniority reject)", () => {
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

  it("FIX #6: recency_score is computed even when skill score is 0", () => {
    // Old code forced recencyScore = 0 in early-return branches (skill gate failures)
    // New code: recencyScore is computed independently
    const job = makeJob({
      title: "Senior Developer",
      description: "Python Django backend only, no frontend skills mentioned",
      // No expert/secondary skills in description → skill_match_score = 0
    });
    const result = scoreJob(job, DEFAULT_SETTINGS);
    // total_score = 0 * 0.6 + liveRecency * 0.3 + 0 * 0.1
    // recency_score should still be computed (not forced to 0)
    expect(result).not.toBeNull();
    expect(result!.recency_score).toBeGreaterThan(0); // FIX #6: not forced to 0
    expect(result!.skill_match_score).toBe(0); // skill didn't match
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

// ── mergeJobs (FIX #6) ───────────────────────────────────────

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

  it("FIX #6: excludes jobs with total_score = 0", () => {
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

  it("merges existing and incoming without duplicates", () => {
    const existing = [makeScoredJob("a", 80), makeScoredJob("b", 60)];
    const incoming = [makeScoredJob("b", 55, NOW - 1000), makeScoredJob("c", 70)]; // b is older
    const result = mergeJobs(existing, incoming);
    expect(result).toHaveLength(3);
    // 'b' from existing should win (it has fresher fetched_at = NOW)
    const b = result.find((j) => j.id === "b");
    expect(b!.total_score).toBe(60); // existing 'b' kept
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

  it("filters out junior jobs", () => {
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

  // ── Bug 2: boilerplate-aware matching ──────────────────────
  // Confirmed against live raw_jobs: every Vercel posting (engineering or
  // not) opens with an identical ~788-char "About Vercel: ... the team
  // behind Next.js" intro. Non-engineering roles never mention React/
  // Next.js again anywhere else in the posting.

  function makeBoilerplateDescription(roleSection: string): string {
    const intro =
      "About Vercel: Vercel is the agentic infrastructure company. We free people and agents " +
      "to ship what's next. For more than a decade, Vercel has shaped how the web is built. As " +
      "the team behind Next.js, v0, and AI SDK, we create products that help builders move from " +
      "idea to production with speed, security, and exceptional developer experience. Now, " +
      "software is entering a new era, and the next generation of products will not just be " +
      "used by people."; // ~430 chars on its own; padded below to clear the 600-char window
    const padding = "Filler company-mission copy padding this intro out further. ".repeat(4); // ~250 chars
    return `${intro} ${padding}${roleSection}`;
  }

  it("rejects a non-engineering role whose only keyword match is the company-intro boilerplate", () => {
    const job = makeJob({
      title: "Account Executive- Startups, Greenfield",
      description: makeBoilerplateDescription(
        "About the Role: You'll build relationships with founders and close new business. " +
          "5+ years of SaaS sales experience required. No frontend or engineering skills needed.",
      ),
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(false);
  });

  it("accepts an engineering role that mentions the keyword again past the intro", () => {
    const job = makeJob({
      title: "Software Engineer, eve",
      description: makeBoilerplateDescription(
        "About the role: We are looking for a Software Engineer to help build eve, Vercel's " +
          "framework for production-ready AI agents. Eve is to agents what Next.js is to web apps. " +
          "Drive DX quality so TypeScript/Next.js developers can ship their first agent in minutes.",
      ),
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(true);
  });

  it("accepts a long posting with two distinct keyword matches even when both sit inside the window", () => {
    const job = makeJob({
      title: "Frontend Engineer",
      description:
        "React and TypeScript experience required. React Native is a plus. " +
        "Padding text with no relevant keywords to push total length well past six hundred characters total. ".repeat(
          8,
        ),
    });
    expect(passesSettingsGate(job, DEFAULT_SETTINGS)).toBe(true);
  });
});
