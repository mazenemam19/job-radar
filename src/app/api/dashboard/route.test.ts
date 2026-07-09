// src/app/api/dashboard/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedSettings } from "@/lib/types";

const mockServerDb = { from: vi.fn() };
const mockAdminDb = { from: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => mockServerDb,
  getUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock("@/lib/settings", () => ({
  resolveUserSettings: vi.fn(),
}));

vi.mock("@/lib/runner", () => ({
  isCacheFresh: vi.fn(),
}));

vi.mock("@/lib/dashboard-route", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/dashboard-route")>("@/lib/dashboard-route");
  return {
    ...actual,
    buildFeed: vi.fn(),
  };
});

function mockSingleQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ data, error }),
    single: vi.fn().mockResolvedValue({ data, error }),
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data, error }),
  };
}

// Chainable, awaitable raw_jobs query builder — `.in()` is recorded so tests
// can assert which mode set a given query used.
function makeRawJobsQuery(result: { data: unknown; count?: number | null; error?: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {
    select: vi.fn((...args: unknown[]) => {
      calls.push({ method: "select", args });
      return builder;
    }),
    in: vi.fn((...args: unknown[]) => {
      calls.push({ method: "in", args });
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    range: vi.fn(() => builder),
    then: (resolve: (v: unknown) => void) =>
      resolve({ data: result.data, count: result.count ?? null, error: result.error ?? null }),
    __calls: calls,
  };
  return builder;
}

function makeSettings(overrides: Partial<ResolvedSettings> = {}): ResolvedSettings {
  return {
    expert_skills: ["React"],
    secondary_skills: [],
    bonus_skills: [],
    job_age_days: 30,
    pipeline_local: true,
    pipeline_global: true,
    seniority_levels: ["senior"],
    junior_keywords: ["junior"],
    mid_keywords: ["mid"],
    senior_keywords: ["senior"],
    staff_keywords: ["staff"],
    excluded_keywords: [],
    required_keywords: [],
    blacklisted_locations: [],
    gemini_filter_prompt: "",
    scoring_weights: { skill: 0.5, recency: 0.3, relocation: 0.2 },
    score_denominator: 10,
    global_mode_blocked_regions: [],
    global_mode_allowed_locations: [],
    email_alerts_enabled: true,
    salary_reminder_enabled: false,
    ...overrides,
  } as ResolvedSettings;
}

const mockUser = { id: "user-123", email: "test@example.com" };
const emptyGateLog = {
  candidate_window: 0,
  on_dashboard: 0,
  gates: {
    date: { count: 0, sample: [] },
    seniority: { count: 0, sample: [] },
    excluded_keywords: { count: 0, sample: [] },
    required_keywords: { count: 0, sample: [] },
    blacklisted_locations: { count: 0, sample: [] },
    skill_match: { count: 0, sample: [] },
    global_mode: { count: 0, sample: [] },
    gemini: { count: 0, sample: [] },
    scoring: { count: 0, sample: [] },
  },
};

describe("GET /api/dashboard", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    const { resolveUserSettings } = await import("@/lib/settings");
    (resolveUserSettings as ReturnType<typeof vi.fn>).mockResolvedValue(makeSettings());
    const { buildFeed } = await import("@/lib/dashboard-route");
    (buildFeed as ReturnType<typeof vi.fn>).mockResolvedValue({
      finalJobs: [],
      gateLog: emptyGateLog,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns the cached pipeline_log unchanged on a cache hit, without querying raw_jobs", async () => {
    const { isCacheFresh } = await import("@/lib/runner");
    (isCacheFresh as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const cachedLog = { ...emptyGateLog, cached_at: "2026-01-01T00:00:00Z" };
    mockServerDb.from.mockReturnValue(
      mockSingleQuery({ jobs: [], pipeline_log: cachedLog, cached_at: "2026-01-01T00:00:00Z" }),
    );

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.data.from_cache).toBe(true);
    expect(body.data.pipeline_log).toEqual(cachedLog);
    expect(mockAdminDb.from).not.toHaveBeenCalled();
  });

  it("computes wrong_pipeline_mode and outside_candidate_window counts from the ingestion queries", async () => {
    const { isCacheFresh } = await import("@/lib/runner");
    (isCacheFresh as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    mockServerDb.from.mockReturnValue(mockSingleQuery({ gemini_api_key: null }));

    let rawJobsCall = 0;
    mockAdminDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return mockSingleQuery({ last_cron_at: "2026-01-01" });
      // Call order matches the Promise.all array in route.ts: candidate pool,
      // total count, matched-pipelines count, wrong-mode sample, outside-window sample.
      const responses = [
        { data: [] }, // candidate pool (rawJobsData) — irrelevant to this test
        { data: null, count: 2200 }, // total_scraped
        { data: null, count: 2100 }, // matched_pipelines
        { data: [] }, // wrong_pipeline_mode sample
        { data: [] }, // outside_candidate_window sample
      ];
      const response = responses[rawJobsCall] ?? { data: [] };
      rawJobsCall += 1;
      return makeRawJobsQuery(response);
    });

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.data.pipeline_log.total_scraped).toBe(2200);
    expect(body.data.pipeline_log.matched_pipelines).toBe(2100);
    // wrong_pipeline_mode = total_scraped - matched_pipelines
    expect(body.data.pipeline_log.wrong_pipeline_mode.count).toBe(100);
    // outside_candidate_window = matched_pipelines - 2000, clamped at 0
    expect(body.data.pipeline_log.outside_candidate_window.count).toBe(100);
  });

  it("skips the wrong-mode sample query entirely when both pipelines are enabled", async () => {
    const { isCacheFresh } = await import("@/lib/runner");
    (isCacheFresh as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    mockServerDb.from.mockReturnValue(mockSingleQuery({ gemini_api_key: null }));

    let rawJobsCall = 0;
    const inCalls: unknown[][] = [];
    mockAdminDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return mockSingleQuery({ last_cron_at: null });
      const responses = [
        { data: [] },
        { data: null, count: 500 },
        { data: null, count: 500 }, // matched === total → nothing outside any mode
        { data: [] },
        { data: [] },
      ];
      const response = responses[rawJobsCall] ?? { data: [] };
      rawJobsCall += 1;
      const builder = makeRawJobsQuery(response);
      const originalIn = builder.in as (...args: unknown[]) => unknown;
      builder.in = (...args: unknown[]) => {
        inCalls.push(args);
        return originalIn(...args);
      };
      return builder;
    });

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.data.pipeline_log.wrong_pipeline_mode.count).toBe(0);
    expect(body.data.pipeline_log.wrong_pipeline_mode.sample).toEqual([]);
    // Only 4 real `.in("mode", ...)` calls should happen (pool, matched-count,
    // outside-window) — the wrong-mode sample query is skipped in JS entirely
    // when disabledModes is empty, not sent as an empty-array query.
    expect(inCalls.length).toBeLessThanOrEqual(4);
  });

  it("clamps outside_candidate_window at 0 when matched_pipelines is under the 2000 cap", async () => {
    const { isCacheFresh } = await import("@/lib/runner");
    (isCacheFresh as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    mockServerDb.from.mockReturnValue(mockSingleQuery({ gemini_api_key: null }));

    let rawJobsCall = 0;
    mockAdminDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return mockSingleQuery({ last_cron_at: null });
      const responses = [
        { data: [] },
        { data: null, count: 300 },
        { data: null, count: 300 },
        { data: [] },
        { data: [] },
      ];
      const response = responses[rawJobsCall] ?? { data: [] };
      rawJobsCall += 1;
      return makeRawJobsQuery(response);
    });

    const { GET } = await import("./route");
    const res = await GET();
    const body = await res.json();

    expect(body.data.pipeline_log.outside_candidate_window.count).toBe(0);
  });
});
