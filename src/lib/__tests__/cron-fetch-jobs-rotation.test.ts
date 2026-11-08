// src/lib/__tests__/cron-fetch-jobs-rotation.test.ts
// The scheduled-company batch has a stable rotating order so every active
// source eventually receives a turn instead of repeatedly favoring the same
// leading records.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../ats-bridge", () => ({
  fetchCompany: vi.fn(),
}));

import type { ATSCompanyRow } from "../types";

function makeCompanyRow(overrides: Partial<ATSCompanyRow> = {}): ATSCompanyRow {
  return {
    id: "comp-1",
    name: "Test Corp",
    ats: "greenhouse",
    slug: "testcorp",
    country: "GB",
    country_flag: "🇬🇧",
    city: "London",
    pipeline_local: true,
    pipeline_global: false,
    is_active: true,
    is_featured: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("fetchAllCompanyJobs — dispatch rotation cursor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("resumes the scheduled batch after the last company dispatched last run", async () => {
    const { fetchCompany } = await import("../ats-bridge");
    const dispatchedOrder: string[] = [];
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      dispatchedOrder.push(row.id);
      return { company: row.name, mode, jobs: [], error: null };
    });

    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");

    const companies = ["c0", "c1", "c2", "c3", "c4"].map((id, i) =>
      makeCompanyRow({ id, created_at: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z` }),
    );

    // Run 1: a 2500ms budget with a 1000ms-per-fetch cost fits exactly 3 of
    // 5 companies before the deadline check trips on the 4th (all 5 workers
    // dispatch in the same synchronous pass, so each one sees the clock
    // already advanced by every worker before it: 0ms, 1000ms, 2000ms,
    // 3000ms — the last two land at/past the 2500ms budget).
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      dispatchedOrder.push(row.id);
      vi.setSystemTime(Date.now() + 1000);
      return { company: row.name, mode, jobs: [], error: null };
    });

    try {
      await fetchAllCompanyJobs(companies, start + 2500, start + 60_000);
    } finally {
      vi.useRealTimers();
    }

    expect(dispatchedOrder).toEqual(["c0", "c1", "c2"]); // c3, c4 skipped — time budget exceeded

    // Run 2: same process, cursor persisted in-memory from run 1 (the DB
    // round-trip itself is covered separately in dispatch-cursor.test.ts).
    // A far-future deadline this time, so nothing gets skipped — only
    // dispatch *order* is under test here.
    dispatchedOrder.length = 0;
    await fetchAllCompanyJobs(companies, Date.now() + 60_000, Date.now() + 120_000);

    // c3 was next after c2 (the last one dispatched in run 1) — it and c4
    // (the other company skipped last run) now go first, instead of
    // restarting at c0.
    expect(dispatchedOrder).toEqual(["c3", "c4", "c0", "c1", "c2"]);
  });

  it("includes Workable companies in the same rotating batch as every other ATS", async () => {
    const { fetchCompany } = await import("../ats-bridge");
    const dispatchedWorkableOrder: string[] = [];
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      if (row.ats === "workable") dispatchedWorkableOrder.push(row.id);
      return { company: row.name, mode, jobs: [], error: null };
    });

    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");

    // Workable rows deliberately have created_at values out of input order.
    // The batch scheduler must use the same stable order for every ATS.
    const companies = [
      makeCompanyRow({ id: "w-late", ats: "workable", created_at: "2025-03-01T00:00:00Z" }),
      makeCompanyRow({ id: "other-1", created_at: "2025-01-01T00:00:00Z" }),
      makeCompanyRow({ id: "w-early", ats: "workable", created_at: "2025-01-15T00:00:00Z" }),
      makeCompanyRow({ id: "other-2", created_at: "2025-02-01T00:00:00Z" }),
    ];

    await fetchAllCompanyJobs(companies, Date.now() + 60_000, Date.now() + 120_000, 2);

    expect(dispatchedWorkableOrder).toEqual(["w-early"]);
  });

  it("covers every company across consecutive bounded batches before repeating", async () => {
    const { fetchCompany } = await import("../ats-bridge");
    const dispatched: string[] = [];
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      dispatched.push(row.id);
      return { company: row.name, mode, jobs: [], error: null };
    });
    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");
    const companies = ["a", "b", "c", "d", "e"].map((id, index) =>
      makeCompanyRow({
        id,
        created_at: `2025-01-0${index + 1}T00:00:00Z`,
        pipeline_local: false,
        pipeline_global: true,
      }),
    );
    const deadline = Date.now() + 60_000;
    const cutoff = Date.now() + 120_000;

    await fetchAllCompanyJobs(companies, deadline, cutoff, 2);
    expect(dispatched).toEqual(["a", "b"]);

    dispatched.length = 0;
    await fetchAllCompanyJobs(companies, deadline, cutoff, 2);
    expect(dispatched).toEqual(["c", "d"]);

    dispatched.length = 0;
    await fetchAllCompanyJobs(companies, deadline, cutoff, 2);
    expect(dispatched).toEqual(["e", "a"]);
  });

  it("resumes the second pipeline of a company before advancing to the next company", async () => {
    const { fetchCompany } = await import("../ats-bridge");
    const dispatched: string[] = [];
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      dispatched.push(`${row.id}:${mode}`);
      return { company: row.name, mode, jobs: [], error: null };
    });
    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");
    const companies = [
      makeCompanyRow({ id: "dual", pipeline_local: true, pipeline_global: true }),
      makeCompanyRow({ id: "next", created_at: "2025-01-02T00:00:00Z" }),
    ];
    const deadline = Date.now() + 60_000;
    const cutoff = Date.now() + 120_000;

    await fetchAllCompanyJobs(companies, deadline, cutoff, 1);
    expect(dispatched).toEqual(["dual:local"]);

    dispatched.length = 0;
    await fetchAllCompanyJobs(companies, deadline, cutoff, 1);
    expect(dispatched).toEqual(["dual:global"]);
  });

  it("ignores active rows without an enabled pipeline instead of stalling the cursor", async () => {
    const { fetchCompany } = await import("../ats-bridge");
    vi.mocked(fetchCompany).mockResolvedValue({
      company: "Ready",
      mode: "local",
      jobs: [],
      error: null,
    });
    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");
    const companies = [
      makeCompanyRow({ id: "invalid", pipeline_local: false, pipeline_global: false }),
      makeCompanyRow({ id: "ready", name: "Ready", created_at: "2025-01-02T00:00:00Z" }),
    ];

    await fetchAllCompanyJobs(companies, Date.now() + 60_000, Date.now() + 120_000, 1);
    expect(fetchCompany).toHaveBeenCalledWith(companies[1], "local", expect.any(AbortSignal));
  });

  it("moves past an aborted early task when a later scheduled task started", async () => {
    vi.useFakeTimers();
    const { fetchCompany } = await import("../ats-bridge");
    const dispatched: string[] = [];
    vi.mocked(fetchCompany).mockImplementation(async (row, mode, signal) => {
      dispatched.push(row.id);
      if (row.id !== "stuck") return { company: row.name, mode, jobs: [], error: null };
      return new Promise((resolve) => {
        signal?.addEventListener(
          "abort",
          () => resolve({ company: row.name, mode, jobs: [], error: "Aborted" }),
          { once: true },
        );
      });
    });
    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");
    const start = Date.now();
    const companies = [
      makeCompanyRow({ id: "stuck", ats: "workable", created_at: "2025-01-01T00:00:00Z" }),
      makeCompanyRow({ id: "fast", created_at: "2025-01-02T00:00:00Z" }),
      makeCompanyRow({ id: "tail", created_at: "2025-01-03T00:00:00Z" }),
    ];

    try {
      const firstRun = fetchAllCompanyJobs(companies, start + 60_000, start + 1_000, 2);
      await vi.advanceTimersByTimeAsync(1_000);
      await firstRun;
      dispatched.length = 0;
      await fetchAllCompanyJobs(companies, Date.now() + 60_000, Date.now() + 120_000, 1);
      expect(dispatched).toEqual(["tail"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
