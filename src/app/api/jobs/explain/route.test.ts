// src/app/api/jobs/explain/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawJob, ResolvedSettings } from "@/lib/types";

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

vi.mock("@/lib/gemini", () => ({
  filterJobsWithGeminiVerbose: vi.fn(),
}));

function mockProfileQuery(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

// Supabase's query builder is itself awaitable — chain methods return the
// same builder, and `await query` resolves via `.then()`.
function makeRawJobsQuery(result: { data: unknown; error: unknown }) {
  const builder: {
    select: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    ilike: ReturnType<typeof vi.fn>;
    then: (resolve: (value: typeof result) => void) => void;
  } = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  };
  return builder;
}

function makeJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    id: "job-1",
    title: "Senior Frontend Engineer",
    company: "Acme Corp",
    location: "London, UK",
    country: "GB",
    country_flag: "🇬🇧",
    url: "https://jobs.example.com/1",
    description: "We need a React and TypeScript expert",
    posted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    date_unknown: false,
    is_remote: false,
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
    job_age_days: 365,
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

describe("GET /api/jobs/explain", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    const { resolveUserSettings } = await import("@/lib/settings");
    (resolveUserSettings as ReturnType<typeof vi.fn>).mockResolvedValue(makeSettings());
    mockServerDb.from.mockReturnValue(mockProfileQuery({ gemini_api_key: null }));
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain?title=engineer"));

    expect(res.status).toBe(401);
  });

  it("returns 400 when neither title nor company is provided", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain"));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("traces a matched job and stops at the first failing gate", async () => {
    const job = makeJob({ title: "Senior Sales Manager" });
    mockAdminDb.from.mockReturnValue(makeRawJobsQuery({ data: [job], error: null }));
    const { resolveUserSettings } = await import("@/lib/settings");
    (resolveUserSettings as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSettings({ excluded_keywords: ["sales"] }),
    );

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain?title=sales"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.matches).toHaveLength(1);
    expect(body.data.matches[0].stopped_at).toBe("excluded_keywords");
    expect(body.data.matches[0].pipeline_match).toBe(true);

    const { filterJobsWithGeminiVerbose } = await import("@/lib/gemini");
    expect(filterJobsWithGeminiVerbose).not.toHaveBeenCalled();
  });

  it("flags pipeline_match: false for a job whose mode isn't enabled, while still tracing its gates", async () => {
    const job = makeJob({ mode: "global", title: "Senior Sales Manager" });
    mockAdminDb.from.mockReturnValue(makeRawJobsQuery({ data: [job], error: null }));
    const { resolveUserSettings } = await import("@/lib/settings");
    (resolveUserSettings as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSettings({ pipeline_global: false, excluded_keywords: ["sales"] }),
    );

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain?title=sales"));
    const body = await res.json();

    expect(body.data.matches[0].pipeline_match).toBe(false);
    // Gate tracing still runs regardless of pipeline match.
    expect(body.data.matches[0].stopped_at).toBe("excluded_keywords");
  });

  it("marks gemini_pending when a job clears every gate but the user has no Gemini key", async () => {
    const job = makeJob();
    mockAdminDb.from.mockReturnValue(makeRawJobsQuery({ data: [job], error: null }));
    mockServerDb.from.mockReturnValue(mockProfileQuery({ gemini_api_key: null }));

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain?title=Senior"));
    const body = await res.json();

    expect(body.data.matches[0].gemini_pending).toBe(true);
    expect(body.data.matches[0].stopped_at).toBeNull();
    const { filterJobsWithGeminiVerbose } = await import("@/lib/gemini");
    expect(filterJobsWithGeminiVerbose).not.toHaveBeenCalled();
  });

  it("fetches a live Gemini decision for a job that clears every earlier gate", async () => {
    const job = makeJob();
    mockAdminDb.from.mockReturnValue(makeRawJobsQuery({ data: [job], error: null }));
    mockServerDb.from.mockReturnValue(mockProfileQuery({ gemini_api_key: "user-key" }));
    const { filterJobsWithGeminiVerbose } = await import("@/lib/gemini");
    (filterJobsWithGeminiVerbose as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: job.id,
        pass: false,
        reason: "Not a fit per your prompt",
        reviewed: true,
        quotaExhausted: false,
      },
    ]);

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain?title=Senior"));
    const body = await res.json();

    expect(filterJobsWithGeminiVerbose).toHaveBeenCalledWith("user-key", [job], expect.anything());
    expect(body.data.matches[0].stopped_at).toBe("gemini");
    expect(body.data.matches[0].gemini_pending).toBe(false);
  });

  it("returns an empty matches array when nothing in the raw pool matches", async () => {
    mockAdminDb.from.mockReturnValue(makeRawJobsQuery({ data: [], error: null }));

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/jobs/explain?title=nonexistent"));
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.matches).toEqual([]);
  });
});
