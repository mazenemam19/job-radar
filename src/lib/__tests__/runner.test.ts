// src/lib/__tests__/runner.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client, ats-bridge, and email before importing runner
vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockDb,
}));

vi.mock("../ats-bridge", () => ({
  fetchCompany: vi.fn(),
}));

vi.mock("../email", () => ({
  sendNewScanNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));

import { fetchCompany } from "../ats-bridge";
import { sendNewScanNotificationEmail } from "../email";
import type { ATSCompanyRow, RawJob } from "../types";

// ── Mock database ─────────────────────────────────────────────

interface ChainMock extends PromiseLike<{ data: unknown; error: unknown }> {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  _resolve: () => Promise<{ data: unknown; error: unknown }>;
}

const mockDb = {
  from: vi.fn(),
};

function makeChain(data: unknown, error: unknown = null): ChainMock {
  const resolve = () => Promise.resolve({ data, error });

  const self: Partial<ChainMock> = {
    _resolve: resolve,
  };

  self.select = vi.fn().mockReturnValue(self);
  self.eq = vi.fn().mockReturnValue(self);
  self.neq = vi.fn().mockReturnValue(self);
  self.in = vi.fn().mockReturnValue(self);
  self.order = vi.fn().mockReturnValue(self);
  self.limit = vi.fn().mockReturnValue(self);
  self.single = vi.fn().mockImplementation(resolve);
  self.insert = vi.fn().mockImplementation(resolve);
  self.update = vi.fn().mockReturnValue({ ...self, then: resolve });
  self.upsert = vi.fn().mockImplementation(resolve);

  self.then = <TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null | undefined,
  ): Promise<TResult1 | TResult2> => {
    return resolve().then(onfulfilled ?? undefined, onrejected ?? undefined);
  };

  return self as ChainMock;
}

// ── Test fixtures ────────────────────────────────────────────

function makeCompanyRow(overrides: Partial<ATSCompanyRow> = {}): ATSCompanyRow {
  return {
    id: "comp-1",
    name: "Test Corp",
    ats: "greenhouse",
    slug: "testcorp",
    country: "GB",
    country_flag: "🇬🇧",
    city: "London",
    pipeline_visa: true,
    pipeline_local: false,
    pipeline_global: false,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRawJob(id: string, overrides: Partial<RawJob> = {}): RawJob {
  return {
    id,
    title: "Senior Engineer",
    company: "Test Corp",
    location: "London",
    country: "GB",
    country_flag: "🇬🇧",
    url: `https://example.com/${id}`,
    description: "React TypeScript",
    posted_at: new Date().toISOString(),
    fetched_at: new Date().toISOString(),
    date_unknown: false,
    is_remote: false,
    salary: null,
    mode: "visa",
    visa_sponsorship: false,
    source_name: "Test Corp",
    ats_type: "greenhouse",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe("runCronJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when no active companies", async () => {
    // DB returns empty companies list
    mockDb.from.mockReturnValue(makeChain([]));

    const { runCronJob } = await import("../runner");
    const result = await runCronJob("manual");

    expect(result.total_fetched).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatch(/No active companies/i);
  });

  it("calls fetchCompany for each enabled pipeline", async () => {
    const company = makeCompanyRow({
      pipeline_visa: true,
      pipeline_local: true,
      pipeline_global: false,
    });

    const jobs = [makeRawJob("j1"), makeRawJob("j2")];

    mockDb.from.mockImplementation((table: string) => {
      if (table === "ats_companies") return makeChain([company]);
      if (table === "raw_jobs") return makeChain(null);
      if (table === "app_config") return makeChain(null);
      if (table === "cron_logs_v2") return makeChain(null);
      return makeChain(null);
    });

    vi.mocked(fetchCompany).mockResolvedValue({
      company: "Test Corp",
      mode: "visa",
      jobs,
      error: null,
    });

    const { runCronJob } = await import("../runner");
    await runCronJob("manual");

    // Should be called twice (visa + local pipelines)
    expect(fetchCompany).toHaveBeenCalledTimes(2);
    expect(fetchCompany).toHaveBeenCalledWith(company, "visa");
    expect(fetchCompany).toHaveBeenCalledWith(company, "local");
  });

  it("records fetch errors in source_health without crashing", async () => {
    const company = makeCompanyRow({ pipeline_visa: true });

    mockDb.from.mockImplementation((table: string) => {
      if (table === "ats_companies") return makeChain([company]);
      return makeChain(null);
    });

    vi.mocked(fetchCompany).mockResolvedValue({
      company: "Test Corp",
      mode: "visa",
      jobs: [],
      error: "ATS timeout",
    });

    const { runCronJob } = await import("../runner");
    const result = await runCronJob("manual");

    expect(result.errors).toContain("Test Corp (visa): ATS timeout");
    expect(result.total_fetched).toBe(0);
  });
});

describe("runCronJob — email notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends scan notification to eligible users after successful scrape", async () => {
    const company = makeCompanyRow({ pipeline_visa: true });
    const jobs = [makeRawJob("j1")];

    mockDb.from.mockImplementation((table: string) => {
      if (table === "ats_companies") return makeChain([company]);
      if (table === "raw_jobs") return makeChain(null);
      if (table === "app_config") return makeChain(null);
      if (table === "cron_logs_v2") return makeChain(null);
      if (table === "user_profiles")
        return makeChain([
          {
            email: "user@example.com",
            user_settings: { email_alerts_enabled: true },
          },
        ]);
      if (table === "default_settings") return makeChain({});
      return makeChain(null);
    });

    vi.mocked(fetchCompany).mockResolvedValue({
      company: "Test Corp",
      mode: "visa",
      jobs,
      error: null,
    });

    const { runCronJob } = await import("../runner");
    await runCronJob("manual");

    expect(vi.mocked(sendNewScanNotificationEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNewScanNotificationEmail)).toHaveBeenCalledWith(1, "user@example.com");
  });

  it("skips users with email_alerts_enabled=false", async () => {
    const company = makeCompanyRow({ pipeline_visa: true });
    const jobs = [makeRawJob("j1")];

    mockDb.from.mockImplementation((table: string) => {
      if (table === "ats_companies") return makeChain([company]);
      if (table === "user_profiles")
        return makeChain([
          {
            email: "opted-out@example.com",
            user_settings: { email_alerts_enabled: false },
          },
        ]);
      if (table === "default_settings") return makeChain({});
      return makeChain(null);
    });

    vi.mocked(fetchCompany).mockResolvedValue({
      company: "Test Corp",
      mode: "visa",
      jobs,
      error: null,
    });

    const { runCronJob } = await import("../runner");
    await runCronJob("manual");

    expect(vi.mocked(sendNewScanNotificationEmail)).not.toHaveBeenCalled();
  });

  it("defaults to sending when user has no user_settings row", async () => {
    const company = makeCompanyRow({ pipeline_visa: true });
    const jobs = [makeRawJob("j1")];

    mockDb.from.mockImplementation((table: string) => {
      if (table === "ats_companies") return makeChain([company]);
      if (table === "user_profiles")
        return makeChain([
          {
            email: "newuser@example.com",
            onboarding_complete: true,
            user_settings: null, // no settings row yet — should still default to sending
          },
        ]);
      if (table === "default_settings") return makeChain({});
      return makeChain(null);
    });

    vi.mocked(fetchCompany).mockResolvedValue({
      company: "Test Corp",
      mode: "visa",
      jobs,
      error: null,
    });

    const { runCronJob } = await import("../runner");
    await runCronJob("manual");

    expect(vi.mocked(sendNewScanNotificationEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendNewScanNotificationEmail)).toHaveBeenCalledWith(1, "newuser@example.com");
  });

  it("does not send emails when no companies were scraped", async () => {
    mockDb.from.mockReturnValue(makeChain([]));

    const { runCronJob } = await import("../runner");
    await runCronJob("manual");

    expect(vi.mocked(sendNewScanNotificationEmail)).not.toHaveBeenCalled();
  });
});

describe("isCacheFresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when user has no cache row", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return makeChain({ last_cron_at: "2025-06-01T09:00:00Z" });
      if (table === "user_jobs_cache") return makeChain(null); // no row
      return makeChain(null);
    });

    const { isCacheFresh } = await import("../runner");
    const fresh = await isCacheFresh("u1");
    expect(fresh).toBe(false);
  });

  it("returns false when cache is older than last cron run", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return makeChain({ last_cron_at: "2025-06-01T09:00:00Z" });
      if (table === "user_jobs_cache") return makeChain({ cached_at: "2025-05-31T09:00:00Z" }); // stale
      return makeChain(null);
    });

    const { isCacheFresh } = await import("../runner");
    const fresh = await isCacheFresh("u1");
    expect(fresh).toBe(false);
  });

  it("returns true when cache is newer than last cron run", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return makeChain({ last_cron_at: "2025-06-01T09:00:00Z" });
      if (table === "user_jobs_cache") return makeChain({ cached_at: "2025-06-01T10:00:00Z" }); // fresh
      return makeChain(null);
    });

    const { isCacheFresh } = await import("../runner");
    const fresh = await isCacheFresh("u1");
    expect(fresh).toBe(true);
  });

  it("returns true when no cron has run yet (no app_config)", async () => {
    mockDb.from.mockImplementation((table: string) => {
      if (table === "app_config") return makeChain(null);
      if (table === "user_jobs_cache") return makeChain({ cached_at: "2025-06-01T09:00:00Z" });
      return makeChain(null);
    });

    const { isCacheFresh } = await import("../runner");
    const fresh = await isCacheFresh("u1");
    expect(fresh).toBe(true); // no cron = nothing to invalidate
  });
});
