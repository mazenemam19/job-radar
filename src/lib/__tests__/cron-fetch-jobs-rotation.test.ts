// src/lib/__tests__/cron-fetch-jobs-rotation.test.ts
// Regression coverage for issue #52, act 7 ("the queue that never rotates"):
// before this fix, ats_companies had no stable dispatch order and no memory
// of where a time-budget skip left off, so whichever companies sat at the
// tail of the fetch stayed skipped forever. These tests fail against that
// pre-fix behavior (a second run restarts from the same top every time) and
// pass once the "other" bucket is sorted and rotated per the persisted
// cursor.
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
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("fetchAllCompanyJobs — dispatch rotation cursor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("resumes the 'other' bucket right after the last company dispatched last run, instead of restarting from the top", async () => {
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

  it("does not reorder the Workable bucket — its input order is untouched by the 'other' bucket's rotation (FR6)", async () => {
    const { fetchCompany } = await import("../ats-bridge");
    const dispatchedWorkableOrder: string[] = [];
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      if (row.ats === "workable") dispatchedWorkableOrder.push(row.id);
      return { company: row.name, mode, jobs: [], error: null };
    });

    const { fetchAllCompanyJobs } = await import("../cron/fetch-jobs");

    // Workable rows deliberately given created_at values OUT of order
    // relative to their position in `companies` — if the fix ever
    // accidentally sorted the whole list instead of just the "other"
    // bucket, this would catch it.
    const companies = [
      makeCompanyRow({ id: "w-late", ats: "workable", created_at: "2025-03-01T00:00:00Z" }),
      makeCompanyRow({ id: "other-1", created_at: "2025-01-01T00:00:00Z" }),
      makeCompanyRow({ id: "w-early", ats: "workable", created_at: "2025-01-15T00:00:00Z" }),
      makeCompanyRow({ id: "other-2", created_at: "2025-02-01T00:00:00Z" }),
    ];

    await fetchAllCompanyJobs(companies, Date.now() + 60_000, Date.now() + 120_000);

    // Workable dispatch followed `companies`' own order (w-late before
    // w-early), not created_at order — proving it was never touched by
    // sortAndRotate.
    expect(dispatchedWorkableOrder).toEqual(["w-late", "w-early"]);
  });
});
