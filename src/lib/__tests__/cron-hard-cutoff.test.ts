import { describe, expect, it, vi } from "vitest";

vi.mock("../ats-bridge", () => ({ fetchCompany: vi.fn() }));

import { fetchCompany } from "../ats-bridge";
import { fetchAllCompanyJobs } from "../cron/fetch-jobs";
import type { ATSCompanyRow } from "../types";

function company(id: string): ATSCompanyRow {
  return {
    id,
    name: id,
    ats: "greenhouse",
    slug: id,
    country: "DE",
    country_flag: "🇩🇪",
    city: "Berlin",
    pipeline_local: true,
    pipeline_global: false,
    is_active: true,
    is_featured: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

describe("fetchAllCompanyJobs hard cutoff", () => {
  it("aborts active ATS work and returns the completed partial result", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    let receivedSignal: AbortSignal | undefined;
    vi.mocked(fetchCompany).mockImplementation(async (row, mode, signal) => {
      if (row.id !== "stuck") return { company: row.name, mode, jobs: [], error: null };
      receivedSignal = signal;
      return new Promise((resolve) => {
        signal?.addEventListener(
          "abort",
          () => resolve({ company: row.name, mode, jobs: [], error: "Aborted" }),
          { once: true },
        );
      });
    });

    try {
      const pending = fetchAllCompanyJobs(
        [company("fast"), company("stuck")],
        start + 60_000,
        start + 10_000,
      );
      await vi.advanceTimersByTimeAsync(10_000);
      const result = await pending;
      expect(receivedSignal?.aborted).toBe(true);
      expect(result.errors).toContain("stuck (local): Aborted");
    } finally {
      vi.useRealTimers();
    }
  });
});
