// src/lib/__tests__/cron-fetch-jobs.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../ats-bridge", () => ({
  fetchCompany: vi.fn(),
}));

import { fetchCompany } from "../ats-bridge";
import { withConcurrencyLimit, fetchAllCompanyJobs } from "../cron/fetch-jobs";
import { WORKABLE_LANE_COUNT } from "../sources/ats/workable";
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

  it("never runs more than `limit` tasks concurrently", async () => {
    // Regression test: a prior version called every task() synchronously
    // before the limit check could stop it, so peak concurrency tracked
    // total task count instead of `limit`. This asserts the actual peak,
    // not just that results eventually come back.
    let current = 0;
    let peak = 0;
    const tasks = Array.from({ length: 266 }, () => async () => {
      current++;
      peak = Math.max(peak, current);
      await new Promise((r) => setTimeout(r, 5));
      current--;
      return true;
    });

    const results = await withConcurrencyLimit(tasks, 8);
    expect(peak).toBe(8);
    expect(results).toHaveLength(266);
  });

  it("preserves result order regardless of completion order", async () => {
    const delays = [30, 5, 20, 1, 15];
    const tasks = delays.map((ms, i) => async () => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });

    const results = await withConcurrencyLimit(tasks, 2);
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("fetchAllCompanyJobs", () => {
  // Deadline/cutoff far in the future — these tests aren't exercising the
  // time budget or the hard cutoff, so nothing should ever be skipped or
  // cut off early.
  const FAR_FUTURE_DEADLINE = Date.now() + 60_000;
  const FAR_FUTURE_CUTOFF = Date.now() + 120_000;

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

    const result = await fetchAllCompanyJobs(companies, FAR_FUTURE_DEADLINE, FAR_FUTURE_CUTOFF);

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

    const result = await fetchAllCompanyJobs(companies, FAR_FUTURE_DEADLINE, FAR_FUTURE_CUTOFF);

    expect(result.errors).toEqual(["Test Corp (local): timeout"]);
    expect(result.allJobs).toHaveLength(1);
    expect(result.sourceHealth["Test Corp:local"]).toBeDefined();
  });

  it("returns empty results when no company has an enabled pipeline", async () => {
    const companies = [makeCompanyRow({ pipeline_local: false, pipeline_global: false })];
    const result = await fetchAllCompanyJobs(companies, FAR_FUTURE_DEADLINE, FAR_FUTURE_CUTOFF);

    expect(fetchCompany).not.toHaveBeenCalled();
    expect(result.allJobs).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it("aggregates warnings separately from errors for an otherwise-successful fetch", async () => {
    // Regression test for issue #52 part 2, priority 4 (Devsquad): a fetch
    // that succeeds with a caveat (e.g. a few dead job-detail links) must
    // not be reported as an error, but the caveat still needs to surface
    // somewhere — this is that somewhere.
    const companies = [makeCompanyRow({ id: "a", name: "Devsquad", pipeline_global: true })];

    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => ({
      company: row.name,
      mode,
      jobs: [makeRawJob("a-global")],
      error: null,
      warnings: [
        "2/15 job detail fetches failed (dead/removed links) — used list description as fallback",
      ],
    }));

    const result = await fetchAllCompanyJobs(companies, FAR_FUTURE_DEADLINE, FAR_FUTURE_CUTOFF);

    expect(result.errors).toHaveLength(0); // succeeded — must not read as a failure
    expect(result.allJobs).toHaveLength(1); // and the jobs still made it through
    expect(result.warnings).toEqual([
      "Devsquad (global): 2/15 job detail fetches failed (dead/removed links) — used list description as fallback",
    ]);
  });
});

describe("fetchAllCompanyJobs — time budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stops dispatching new fetches once the deadline has passed, recording the rest as skipped", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start); // pin the fake clock's starting point explicitly

    // 5 companies, all under the 8-way concurrency limit, so every task
    // reaches its deadline check in the same synchronous dispatch pass —
    // this isolates the deadline check from the concurrency throttle.
    const deadline = start + 5000;
    const hardCutoff = start + 60_000; // far beyond this test's ~6s of simulated time
    const companies = Array.from({ length: 5 }, (_, i) =>
      makeCompanyRow({ id: `c${i}`, name: `Company ${i}`, pipeline_local: true }),
    );

    let elapsed = 0;
    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      elapsed += 3000; // each fetch "costs" 3s of wall-clock time
      vi.setSystemTime(Date.now() + 3000);
      return { company: row.name, mode, jobs: [makeRawJob(`${row.id}-${mode}`)], error: null };
    });

    try {
      const result = await fetchAllCompanyJobs(companies, deadline, hardCutoff);

      // 2 real fetches fit inside the 5s budget (0s, 3s); the 3rd task
      // starts at 6s, past the deadline, so it and everything after it
      // is skipped without ever calling fetchCompany.
      expect(fetchCompany).toHaveBeenCalledTimes(2);
      expect(result.allJobs).toHaveLength(2);
      expect(elapsed).toBe(6000);

      const skipped = result.errors.filter((e) => e.includes("Skipped — time budget exceeded"));
      expect(skipped).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not skip anything when every fetch finishes inside the deadline", async () => {
    const deadline = Date.now() + 60_000;
    const hardCutoff = Date.now() + 120_000;
    const companies = [makeCompanyRow({ pipeline_local: true, pipeline_global: true })];

    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => ({
      company: row.name,
      mode,
      jobs: [],
      error: null,
    }));

    const result = await fetchAllCompanyJobs(companies, deadline, hardCutoff);

    expect(fetchCompany).toHaveBeenCalledTimes(2);
    expect(result.errors).toHaveLength(0);
  });
});

describe("fetchAllCompanyJobs — hard cutoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns within the hard cutoff with partial results when some fetches never resolve", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const deadline = start + 60_000; // soft deadline never reached in this test
    const hardCutoff = start + 10_000;

    // 2 companies resolve quickly; 1 never resolves at all (simulates the
    // "dispatched right before the deadline, then runs long" scenario from
    // docs/solutions/bugs/issue-52-504-recurrence-part6.md — a single
    // company task with no ceiling on its own total duration).
    const companies = [
      makeCompanyRow({ id: "fast-1", name: "Fast One", pipeline_local: true }),
      makeCompanyRow({ id: "fast-2", name: "Fast Two", pipeline_local: true }),
      makeCompanyRow({ id: "stuck", name: "Stuck Co", pipeline_local: true }),
    ];

    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => {
      if (row.id === "stuck") return new Promise(() => {}); // never settles
      return { company: row.name, mode, jobs: [makeRawJob(`${row.id}-${mode}`)], error: null };
    });

    try {
      const resultPromise = fetchAllCompanyJobs(companies, deadline, hardCutoff);
      // Let the two fast fetches settle (real microtask resolution, not tied
      // to the fake clock), then advance the fake clock past the cutoff so
      // hardCutoffSignal's setTimeout actually fires.
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(10_000);

      const result = await resultPromise;

      expect(result.allJobs.map((j) => j.id).sort()).toEqual(["fast-1-local", "fast-2-local"]);
      expect(result.errors).toHaveLength(0); // the stuck task simply never reported in — not a failure
      expect(fetchCompany).toHaveBeenCalledTimes(3); // all 3 were dispatched; "stuck" just never finished
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not cut off early when every fetch settles before the hard cutoff", async () => {
    const deadline = Date.now() + 60_000;
    const hardCutoff = Date.now() + 60_000;
    const companies = [makeCompanyRow({ id: "a", pipeline_local: true, pipeline_global: true })];

    vi.mocked(fetchCompany).mockImplementation(async (row, mode) => ({
      company: row.name,
      mode,
      jobs: [makeRawJob(`${row.id}-${mode}`)],
      error: null,
    }));

    const result = await fetchAllCompanyJobs(companies, deadline, hardCutoff);

    expect(result.allJobs).toHaveLength(2); // both pipelines' jobs made it through, not cut short
  });
});

describe("fetchAllCompanyJobs — Workable gets its own concurrency pool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regression test for issue-52-504-recurrence-part5: a batch of Workable
  // companies dispatching at once used to share the same global 8-slot pool
  // as every other ATS type, so a pileup of slow/stuck Workable fetches
  // could crowd out dispatch for unrelated companies until the fetch-phase
  // deadline passed. Workable must now be capped at its own lane-sized pool,
  // leaving the other pool's slots untouched.
  it("does not let a stalled batch of Workable fetches reduce dispatch for other ATS types", async () => {
    let workableCallCount = 0;
    let otherCallCount = 0;
    const releaseWorkable: Array<() => void> = [];

    vi.mocked(fetchCompany).mockImplementation((row, mode) => {
      if (row.ats === "workable") {
        workableCallCount++;
        // Never resolves on its own — simulates a Workable fetch stuck deep
        // in its own lane/backoff loop. If these ever share a pool with the
        // other ATS types, they'll eat slots those other fetches need.
        return new Promise((resolve) => {
          releaseWorkable.push(() => resolve({ company: row.name, mode, jobs: [], error: null }));
        });
      }
      otherCallCount++;
      return Promise.resolve({ company: row.name, mode, jobs: [], error: null });
    });

    // More Workable companies than WORKABLE_LANE_COUNT, and more other-ATS
    // companies than would fit in the shared 8-slot pool if Workable were
    // hogging most of it — this only stays green if the pools are separate.
    const companies = [
      ...Array.from({ length: 6 }, (_, i) =>
        makeCompanyRow({
          id: `w${i}`,
          name: `Workable ${i}`,
          ats: "workable",
          pipeline_global: true,
        }),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        makeCompanyRow({
          id: `g${i}`,
          name: `Greenhouse ${i}`,
          ats: "greenhouse",
          pipeline_global: true,
        }),
      ),
    ];

    const deadline = Date.now() + 60_000;
    const hardCutoff = Date.now() + 120_000; // real timer, unref'd — never actually waited on
    const pending = fetchAllCompanyJobs(companies, deadline, hardCutoff);

    // Let dispatch actually happen without waiting on the stuck Workable
    // promises, which never resolve on their own.
    await new Promise((r) => setTimeout(r, 10));

    expect(workableCallCount).toBe(WORKABLE_LANE_COUNT); // capped at its own pool size
    expect(otherCallCount).toBe(10); // every other-ATS task dispatched and finished regardless

    // Drain the Workable pool wave-by-wave: releasing the current batch lets
    // its workers pick up the next task, which pushes a fresh unresolved
    // promise onto releaseWorkable — so a single one-shot release wouldn't
    // reach every wave.
    while (releaseWorkable.length > 0) {
      releaseWorkable.splice(0, releaseWorkable.length).forEach((release) => release());
      await new Promise((r) => setTimeout(r, 0));
    }
    await pending;
  });
});
