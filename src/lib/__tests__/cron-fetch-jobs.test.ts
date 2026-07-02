// src/lib/__tests__/cron-fetch-jobs.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../ats-bridge", () => ({
  fetchCompany: vi.fn(),
}));

import { fetchCompany } from "../ats-bridge";
import { withConcurrencyLimit, fetchAllCompanyJobs } from "../cron/fetch-jobs";
import type { ATSCompanyRow, RawJob } from "../types";

function makeCompanyRow(overrides: Partial<ATSCompanyRow> = {}): ATSCompanyRow {
  return {
    id: "comp-1",
    name: "Test Corp",
    ats: "greenhouse",
    slug: "testcorp",
    country: "GB",
    country_flag: "🇬🇧",
    city: "London",
    pipeline_local: false,
    pipeline_global: false,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRawJob(id: string): RawJob {
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
    mode: "global",
    visa_sponsorship: false,
    source_name: "Test Corp",
    ats_type: "greenhouse",
    created_at: new Date().toISOString(),
  };
}

describe("withConcurrencyLimit", () => {
  it("runs every task and preserves each result", async () => {
    const tasks = [1, 2, 3, 4, 5].map((n) => () => Promise.resolve(n * 10));
    const results = await withConcurrencyLimit(tasks, 2);
    expect(results.sort()).toEqual([10, 20, 30, 40, 50]);
  });

  it("settles every task even when the limit is smaller than the task count", async () => {
    let settled = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      await new Promise((r) => setTimeout(r, 1));
      settled++;
      return true;
    });

    const results = await withConcurrencyLimit(tasks, 3);
    expect(settled).toBe(10);
    expect(results).toHaveLength(10);
  });
});

describe("fetchAllCompanyJobs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds one task per enabled pipeline and aggregates jobs", async () => {
    const companies = [
      makeCompanyRow({ id: "a", name: "Company A", pipeline_local: true, pipeline_global: true }),
      makeCompanyRow({ id: "b", name: "Company B", pipeline_local: true, pipeline_global: false }),
    ];

    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => ({
      company: row.name,
      mode,
      jobs: [makeRawJob(`${row.id}-${mode}`)],
      error: null,
    }));

    const result = await fetchAllCompanyJobs(companies);

    expect(fetchCompany).toHaveBeenCalledTimes(3); // a:local, a:global, b:local
    expect(result.allJobs).toHaveLength(3);
    expect(result.errors).toHaveLength(0);
    expect(Object.keys(result.sourceHealth)).toHaveLength(3);
  });

  it("records per-source errors without dropping successful sources", async () => {
    const companies = [
      makeCompanyRow({ id: "a", pipeline_local: true }),
      makeCompanyRow({ id: "b", pipeline_local: true }),
    ];

    vi.mocked(fetchCompany).mockImplementation(async (row) => {
      if (row.id === "a") return { company: row.name, mode: "local", jobs: [], error: "timeout" };
      return { company: row.name, mode: "local", jobs: [makeRawJob("b-local")], error: null };
    });

    const result = await fetchAllCompanyJobs(companies);

    expect(result.errors).toEqual(["Test Corp (local): timeout"]);
    expect(result.allJobs).toHaveLength(1);
    expect(result.sourceHealth["Test Corp:local"]).toBeDefined();
  });

  it("returns empty results when no company has an enabled pipeline", async () => {
    const companies = [makeCompanyRow({ pipeline_local: false, pipeline_global: false })];
    const result = await fetchAllCompanyJobs(companies);

    expect(fetchCompany).not.toHaveBeenCalled();
    expect(result.allJobs).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
