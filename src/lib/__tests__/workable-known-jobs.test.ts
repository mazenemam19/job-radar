// src/lib/__tests__/workable-known-jobs.test.ts
//
// Issue #52 part 6, Task 2: most Workable request volume was redundant —
// every cron run re-fetched every open role's detail page unconditionally,
// even for jobs already on file with an unchanged description, and that
// volume is very likely most of what trips Workable's rate limiter in the
// first place. Regression guard: a job whose id is already in raw_jobs must
// reuse its stored description and skip the detail-page network call; an
// unseen id must still be fetched fresh.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ATSConfig } from "@/types";

const mockDb = { from: vi.fn() };

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockDb,
}));

function mockKnownJobsSelect(
  data: { id: string; description: string }[] | null,
  error: unknown = null,
) {
  mockDb.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data, error }),
    }),
  });
}

describe("loadKnownWorkableJobsFromDB / getKnownWorkableDescription", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("queries raw_jobs scoped to ats_type = 'workable'", async () => {
    mockKnownJobsSelect([]);
    const { loadKnownWorkableJobsFromDB } = await import("../sources/ats/known-jobs");
    await loadKnownWorkableJobsFromDB();

    expect(mockDb.from).toHaveBeenCalledWith("raw_jobs");
    const selectFn = mockDb.from.mock.results[0].value.select;
    expect(selectFn).toHaveBeenCalledWith("id, description");
    const eqFn = selectFn.mock.results[0].value.eq;
    expect(eqFn).toHaveBeenCalledWith("ats_type", "workable");
  });

  it("returns undefined for an id it never loaded", async () => {
    mockKnownJobsSelect([]);
    const { loadKnownWorkableJobsFromDB, getKnownWorkableDescription } =
      await import("../sources/ats/known-jobs");
    await loadKnownWorkableJobsFromDB();
    expect(getKnownWorkableDescription("global_workable_acme_eng-1")).toBeUndefined();
  });

  it("returns the stored description for a loaded id", async () => {
    mockKnownJobsSelect([{ id: "global_workable_acme_eng-1", description: "stored desc" }]);
    const { loadKnownWorkableJobsFromDB, getKnownWorkableDescription } =
      await import("../sources/ats/known-jobs");
    await loadKnownWorkableJobsFromDB();
    expect(getKnownWorkableDescription("global_workable_acme_eng-1")).toBe("stored desc");
  });

  it("logs and leaves the cache empty when the select fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockKnownJobsSelect(null, { message: "connection reset" });
    const { loadKnownWorkableJobsFromDB, getKnownWorkableDescription } =
      await import("../sources/ats/known-jobs");
    await loadKnownWorkableJobsFromDB();

    expect(getKnownWorkableDescription("anything")).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[known-jobs] loadKnownWorkableJobsFromDB select failed:",
      "connection reset",
    );
    consoleErrorSpy.mockRestore();
  });
});

describe("fetchWorkable — skips detail fetch for known jobs", () => {
  const baseCompany: ATSConfig = {
    name: "Acme",
    slug: "acme",
    country: "US",
    countryFlag: "🇺🇸",
    ats: "workable",
  };

  function mockListResponse(jobs: unknown[]) {
    return {
      status: 200,
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      text: async () => JSON.stringify({ jobs }),
    };
  }

  const ADVANCE_MS = 40_000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("reuses the stored description for a known job (no detail fetch); still fetches an unseen job's detail page fresh", async () => {
    mockKnownJobsSelect([
      { id: "global_workable_acme_known-1", description: "stored desc for known-1" },
    ]);

    const detailFetchedShortcodes: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const isDetail = url.includes("/jobs/");
        if (!isDetail) {
          return Promise.resolve(
            mockListResponse([
              {
                shortcode: "known-1",
                title: "Known Role",
                description: "list fallback for known-1",
              },
              { shortcode: "new-1", title: "New Role", description: "list fallback for new-1" },
            ]),
          );
        }
        const shortcode = url.match(/\/jobs\/([^/?]+)/)?.[1] ?? "";
        detailFetchedShortcodes.push(shortcode);
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({ full_description: "fresh detail desc" }),
        });
      }),
    );

    const { loadKnownWorkableJobsFromDB } = await import("../sources/ats/known-jobs");
    await loadKnownWorkableJobsFromDB();
    const { fetchWorkable } = await import("../sources/ats/workable");

    const pending = fetchWorkable({ ...baseCompany }, "global");
    await vi.advanceTimersByTimeAsync(ADVANCE_MS);
    const result = await pending;

    expect(result.ok).toBe(true);
    expect(result.warnings).toBeUndefined();
    expect(detailFetchedShortcodes).toEqual(["new-1"]); // known-1's detail page was never hit

    const knownJob = result.jobs.find((j) => j.id === "global_workable_acme_known-1");
    const newJob = result.jobs.find((j) => j.id === "global_workable_acme_new-1");
    expect(knownJob?.description).toBe("stored desc for known-1"); // reused, not the list fallback
    expect(newJob?.description).toBe("fresh detail desc"); // unseen job still fetched fresh
  });
});
