// src/lib/__tests__/workable-detail-warnings.test.ts
//
// Issue #52 part 2, priority 4 (Devsquad): a job's detail page can 404
// between the list call and the detail fetch (delisted, stale shortcode).
// That's routine board churn, not a fetch failure — the company must still
// report success, with the failure count surfaced as a non-blocking
// warning instead of silently vanishing into a list-description fallback.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ATSConfig } from "@/types";

const baseCompany: ATSConfig = {
  name: "Devsquad",
  slug: "devsquad",
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

describe("fetchWorkable — per-job detail-fetch warnings", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("reports a non-blocking warning (not an error) when some job detail fetches 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const isDetail = url.includes("/jobs/");
        if (!isDetail) {
          return Promise.resolve(
            mockListResponse(
              Array.from({ length: 5 }, (_, i) => ({
                shortcode: `job-${i}`,
                title: `Role ${i}`,
                description: "fallback desc",
              })),
            ),
          );
        }
        // jobs 0 and 1 are dead links, the rest resolve fine
        const idx = Number(url.match(/job-(\d+)/)?.[1]);
        if (idx < 2) {
          return Promise.resolve({ status: 404, ok: false, headers: new Headers() });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({ full_description: "real desc" }),
        });
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    const pending = fetchWorkable({ ...baseCompany }, "global");
    await vi.advanceTimersByTimeAsync(ADVANCE_MS);
    const result = await pending;

    expect(result.ok).toBe(true); // the company fetch overall still succeeds
    expect(result.error).toBeUndefined(); // dead links are not a fetch error
    expect(result.jobs).toHaveLength(5); // every job still comes through
    expect(result.warnings).toEqual([
      "2/5 job detail fetches failed (dead/removed links) — used list description as fallback",
    ]);
  });

  it("omits warnings entirely when every detail fetch succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const isDetail = url.includes("/jobs/");
        if (!isDetail) {
          return Promise.resolve(
            mockListResponse([{ shortcode: "job-0", title: "Role", description: "d" }]),
          );
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({ full_description: "real desc" }),
        });
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    const pending = fetchWorkable({ ...baseCompany }, "global");
    await vi.advanceTimersByTimeAsync(ADVANCE_MS);
    const result = await pending;

    expect(result.ok).toBe(true);
    expect(result.warnings).toBeUndefined();
  });
});
