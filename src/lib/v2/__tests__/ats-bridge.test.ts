// src/lib/v2/__tests__/ats-bridge.test.ts
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
}));

import * as atsUtils from "@/lib/sources/ats-utils";
import { fetchCompany } from "../ats-bridge";
import type { ATSCompanyRow } from "../types";
import type { Job } from "@/types";

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
    pipeline_visa: true,
    pipeline_local: false,
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

  it("calls the correct fetcher based on ats type", async () => {
    vi.mocked(atsUtils.fetchGreenhouse).mockResolvedValue({ jobs: [] });
    const row = makeRow({ ats: "greenhouse" });
    await fetchCompany(row, "visa");
    expect(atsUtils.fetchGreenhouse).toHaveBeenCalledOnce();
  });

  it("FIX #5: marks date_unknown = true when postedAt is within 30s of fetchedAt", async () => {
    // Simulate parseRelativeDate returning "now" as a fallback for unknown dates
    const fakeNowIso = new Date(NOW).toISOString(); // exactly now — the buggy fallback value

    vi.mocked(atsUtils.fetchGreenhouse).mockResolvedValue({
      jobs: [
        {
          id: "job-1",
          title: "Senior Engineer",
          url: "https://boards.greenhouse.io/testco/jobs/1",
          description: "React TypeScript",
          postedAt: fakeNowIso,
          location: "London",
        } as unknown as Job,
      ],
    });

    const row = makeRow({ ats: "greenhouse" });
    const result = await fetchCompany(row, "visa");

    expect(result.error).toBeNull();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].date_unknown).toBe(true);
    // posted_at should be set to fetched_at (not the fake "now" from parseRelativeDate)
    // In this case they're the same value since fetched_at IS now, which is correct
    // The key fix is date_unknown = true so the date gate uses fetched_at
  });

  it("FIX #5: does NOT mark date_unknown for genuinely recent jobs with known dates", async () => {
    // A job posted 2 days ago — real date, not a fallback
    const twoDaysAgo = new Date(NOW - 2 * 86_400_000).toISOString();

    vi.mocked(atsUtils.fetchGreenhouse).mockResolvedValue({
      jobs: [
        {
          id: "job-2",
          title: "Senior React Dev",
          url: "https://boards.greenhouse.io/testco/jobs/2",
          description: "React",
          postedAt: twoDaysAgo,
          location: "London",
        } as unknown as Job,
      ],
    });

    const row = makeRow({ ats: "greenhouse" });
    const result = await fetchCompany(row, "visa");

    expect(result.jobs[0].date_unknown).toBe(false);
    expect(result.jobs[0].posted_at).toBe(twoDaysAgo);
  });

  it("returns error result (not thrown) when fetcher throws", async () => {
    vi.mocked(atsUtils.fetchGreenhouse).mockRejectedValue(new Error("ATS timeout after 30s"));
    const row = makeRow({ ats: "greenhouse" });
    const result = await fetchCompany(row, "visa");

    expect(result.error).toContain("ATS timeout");
    expect(result.jobs).toHaveLength(0);
  });

  it("returns error for unsupported ATS type", async () => {
    const row = makeRow({ ats: "bamboohr" });
    const result = await fetchCompany(row, "global");
    // bamboohr is listed as unsupported in the bridge
    expect(result.error).not.toBeNull();
    expect(result.jobs).toHaveLength(0);
  });

  it("tags all returned jobs with the correct mode", async () => {
    vi.mocked(atsUtils.fetchLever).mockResolvedValue({
      jobs: [
        {
          id: "j1",
          title: "Engineer",
          url: "https://lever.co/testco/j1",
          description: "React",
          postedAt: new Date(NOW - 86_400_000).toISOString(),
          location: "Berlin",
        } as unknown as Job,
        {
          id: "j2",
          title: "Designer",
          url: "https://lever.co/testco/j2",
          description: "Figma",
          postedAt: new Date(NOW - 86_400_000).toISOString(),
          location: "Berlin",
        } as unknown as Job,
      ],
    });

    const row = makeRow({ ats: "lever" });
    const result = await fetchCompany(row, "global");

    expect(result.jobs.every((j) => j.mode === "global")).toBe(true);
  });
});
