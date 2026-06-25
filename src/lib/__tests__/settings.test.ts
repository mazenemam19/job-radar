// src/lib/__tests__/settings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the private mergeWithDefaults logic by testing resolveUserSettings
// with mocked Supabase clients. The key behaviour to verify:
//   1. uses_defaults = true  → all fields come from defaults
//   2. uses_defaults = false → per-field: user value if non-null, else default
//   3. Weights are normalised if they don't sum to 1

// ── Mock Supabase clients ──────────────────────────────────────
// getDefaultSettings() reads default_settings via the service-role client
// (global config, not user-owned). getUserSettingsRow()/saveUserSettings()
// read/write user_settings via the auth-aware client (RLS own-row policy).
// See docs/plans/2026-06-23-phase4-data-access-migration.md, task 7.

const mockAdminDb = {
  from: vi.fn(),
};

const mockServerDb = {
  from: vi.fn(),
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

vi.mock("../supabase/server", () => ({
  createServerClient: () => mockServerDb,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

// Helper to create a mock Supabase query chain
function mockQuery(returnData: unknown, returnError: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };
  return chain;
}

// ── Test data ────────────────────────────────────────────────

const DEFAULT_ROW = {
  id: 1,
  expert_skills: ["React", "TypeScript", "JavaScript"],
  secondary_skills: ["Jest", "GraphQL"],
  bonus_skills: ["Node.js"],
  job_age_days: 7,
  pipeline_visa: true,
  pipeline_local: true,
  pipeline_global: true,
  seniority_allow_mid: false,
  gemini_filter_prompt: "Default prompt text",
  scoring_weights: { skill: 0.6, recency: 0.3, relocation: 0.1 },
  score_denominator: 18,
  excluded_keywords: ["backend", "fullstack"],
  blacklisted_locations: ["israel", "us only"],
  required_keywords: ["react", "next.js"],
  salary_reminder_enabled: true,
  updated_at: "2025-01-01T00:00:00Z",
};

// ── Tests ────────────────────────────────────────────────────

describe("resolveUserSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all defaults when uses_defaults = true", async () => {
    // Default settings query
    const defaultQuery = mockQuery(DEFAULT_ROW);
    // User settings query — row says uses_defaults = true
    const userQuery = mockQuery({ user_id: "u1", uses_defaults: true, expert_skills: null });

    mockAdminDb.from.mockImplementation((table: string) =>
      table === "default_settings" ? defaultQuery : mockQuery(null, { message: "unknown table" }),
    );
    mockServerDb.from.mockImplementation((table: string) =>
      table === "user_settings" ? userQuery : mockQuery(null, { message: "unknown table" }),
    );

    const { resolveUserSettings } = await import("../settings");
    const result = await resolveUserSettings("u1");

    expect(result.expert_skills).toEqual(DEFAULT_ROW.expert_skills);
    expect(result.job_age_days).toBe(7);
    expect(result.gemini_filter_prompt).toBe("Default prompt text");
    expect(result.salary_reminder_enabled).toBe(true);
  });

  it("uses user values when non-null (uses_defaults = false)", async () => {
    const userSettingsRow = {
      user_id: "u2",
      uses_defaults: false,
      expert_skills: ["Vue", "Svelte"], // overridden
      secondary_skills: null, // inherit default
      bonus_skills: null,
      job_age_days: 14, // overridden
      pipeline_visa: false, // overridden
      pipeline_local: null,
      pipeline_global: null,
      seniority_allow_mid: null,
      gemini_filter_prompt: null,
      scoring_weights: null,
      score_denominator: null,
      salary_reminder_enabled: false, // overridden — independent of email_alerts_enabled
    };

    const defaultQuery = mockQuery(DEFAULT_ROW);
    const userQuery = mockQuery(userSettingsRow);

    mockAdminDb.from.mockImplementation((table: string) =>
      table === "default_settings" ? defaultQuery : mockQuery(null),
    );
    mockServerDb.from.mockImplementation((table: string) =>
      table === "user_settings" ? userQuery : mockQuery(null),
    );

    const { resolveUserSettings } = await import("../settings");
    const result = await resolveUserSettings("u2");

    // User-overridden fields
    expect(result.expert_skills).toEqual(["Vue", "Svelte"]);
    expect(result.job_age_days).toBe(14);
    expect(result.pipeline_visa).toBe(false);

    // Null user fields → inherit defaults
    expect(result.secondary_skills).toEqual(DEFAULT_ROW.secondary_skills);
    expect(result.pipeline_local).toBe(DEFAULT_ROW.pipeline_local);
    expect(result.gemini_filter_prompt).toBe(DEFAULT_ROW.gemini_filter_prompt);

    // The two email toggles resolve independently of each other
    expect(result.salary_reminder_enabled).toBe(false); // explicitly overridden
  });

  it("normalises scoring weights when they don't sum to 1", async () => {
    const userWithBadWeights = {
      user_id: "u3",
      uses_defaults: false,
      expert_skills: null,
      secondary_skills: null,
      bonus_skills: null,
      job_age_days: null,
      pipeline_visa: null,
      pipeline_local: null,
      pipeline_global: null,
      seniority_allow_mid: null,
      gemini_filter_prompt: null,
      score_denominator: null,
      // Weights that don't sum to 1 (sum = 1.5)
      scoring_weights: { skill: 0.6, recency: 0.6, relocation: 0.3 },
    };

    const defaultQuery = mockQuery(DEFAULT_ROW);
    const userQuery = mockQuery(userWithBadWeights);

    mockAdminDb.from.mockImplementation((table: string) =>
      table === "default_settings" ? defaultQuery : mockQuery(null),
    );
    mockServerDb.from.mockImplementation((table: string) =>
      table === "user_settings" ? userQuery : mockQuery(null),
    );

    const { resolveUserSettings } = await import("../settings");
    const result = await resolveUserSettings("u3");

    const { skill, recency, relocation } = result.scoring_weights;
    const total = skill + recency + relocation;

    // Normalised — must sum to exactly 1 (within floating point tolerance)
    expect(Math.abs(total - 1)).toBeLessThan(0.001);
  });

  it("falls back to hardcoded defaults when DB returns no row", async () => {
    const defaultQuery = mockQuery(null, { message: "no row" });
    const userQuery = mockQuery(null, { message: "no row" });

    mockAdminDb.from.mockImplementation((table: string) =>
      table === "default_settings" ? defaultQuery : mockQuery(null),
    );
    mockServerDb.from.mockImplementation((table: string) =>
      table === "user_settings" ? userQuery : mockQuery(null),
    );

    const { resolveUserSettings } = await import("../settings");
    const result = await resolveUserSettings("u4");

    // Should fall back to hardcoded FALLBACK_DEFAULTS
    expect(result.expert_skills).toContain("React");
    expect(result.score_denominator).toBe(18);
    expect(result.scoring_weights.skill).toBeCloseTo(0.6);
    expect(result.salary_reminder_enabled).toBe(true);
  });

  it("saveUserSettings strips role field for security", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    const upsertChain = {
      from: vi.fn().mockReturnThis(),
      upsert: upsertMock,
    };

    mockServerDb.from.mockReturnValue(upsertChain);

    const { saveUserSettings } = await import("../settings");
    await saveUserSettings("u5", {
      uses_defaults: false,
      job_age_days: 14,
      // @ts-expect-error intentional test of security strip
      role: "admin",
    });

    const call = upsertMock.mock.calls[0][0];
    expect(call).not.toHaveProperty("role");
    expect(call).toHaveProperty("job_age_days", 14);
  });
});
