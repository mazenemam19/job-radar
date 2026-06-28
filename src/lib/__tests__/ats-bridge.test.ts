// src/lib/__tests__/ats-bridge.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the ATS fetchers from the existing (read-only) ats-utils.ts
vi.mock("@/lib/sources/ats-utils", () => ({
  fetchGreenhouse: vi.fn(),
  fetchLever: vi.fn(),
  fetchAshby: vi.fn(),
  fetchWorkable: vi.fn(),
  fetchTeamtailor: vi.fn(),
  fetchBreezy: vi.fn(),
  fetchSmartRecruiters: vi.fn(),
  fetchBambooHR: vi.fn(),
  fetchJazzHR: vi.fn(),
}));

import * as atsUtils from "@/lib/sources/ats-utils";
import { fetchCompany } from "../ats-bridge";
import type { ATSCompanyRow } from "../types";

const NOW = new Date("2025-06-01T12:00:00.000Z").getTime();

function makeRow(overrides: Partial<ATSCompanyRow> = {}): ATSCompanyRow {
  return {
    id: "r1",
    name: "TestCo",
    ats: "greenhouse",
    slug: "testco",
    country: "GB",
    country_flag: "🇬🇧",
    city: null,
    pipeline_local: true,
    pipeline_global: false,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("fetchCompany", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mockFetchResponse(jobs: unknown[]) {
    (atsUtils.fetchGreenhouse as ReturnType<typeof vi.fn>).mockResolvedValue({ jobs });
  }

  it("normalizes jobs and tags them with the correct mode", async () => {
    const twoDaysAgo = new Date(NOW - 2 * 86_400_000).toISOString();
    mockFetchResponse([
      {
        id: "https://example.com/job/1",
        title: "Senior Engineer",
        postedAt: twoDaysAgo,
        isRemote: true,
      },
    ]);

    const result = await fetchCompany(makeRow(), "global");

    expect(result.error).toBeNull();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].mode).toBe("global");
    expect(result.jobs[0].date_unknown).toBe(false);
  });

  it("sets date_unknown when postedAt is near fetchedAt", async () => {
    mockFetchResponse([
      {
        id: "https://example.com/job/2",
        title: "Engineer",
        postedAt: "just now",
        isRemote: false,
      },
    ]);

    const result = await fetchCompany(makeRow(), "local");

    expect(result.jobs[0].date_unknown).toBe(true);
    expect(result.jobs[0].mode).toBe("local");
  });

  it("passes through description from fetcher", async () => {
    const desc = "<p>Some <strong>HTML</strong> content</p>";
    mockFetchResponse([
      {
        id: "https://example.com/job/3",
        title: "Developer",
        description: desc,
        postedAt: new Date(NOW - 86_400_000).toISOString(),
        isRemote: false,
      },
    ]);

    const result = await fetchCompany(makeRow(), "global");

    // Bridge passes through whatever the fetcher returns (HTML stripping happens in fetcher)
    expect(result.jobs[0].description).toBe(desc);
  });

  it("returns empty jobs array with error on fetch failure", async () => {
    (atsUtils.fetchGreenhouse as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error"),
    );

    const result = await fetchCompany(makeRow(), "global");

    expect(result.error).toBe("Network error");
    expect(result.jobs).toHaveLength(0);
  });

  it("uses fallback company name when job has none", async () => {
    mockFetchResponse([
      {
        id: "https://example.com/job/4",
        title: "No Company Job",
        postedAt: "3 days ago",
        isRemote: false,
      },
    ]);

    const result = await fetchCompany(makeRow({ name: "FallbackCo" }), "global");

    expect(result.jobs[0].company).toBe("FallbackCo");
  });
});
