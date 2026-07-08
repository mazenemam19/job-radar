// src/lib/__tests__/workable-rate-limit.test.ts
// Every Workable request (list or detail, either mode) shares one host,
// apply.workable.com, and routes through a bounded lane pool: never more
// than WORKABLE_LANE_COUNT requests in flight at once, each still staggered
// within its own lane, and a 429 on the list call retries instead of
// giving up immediately.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ATSConfig } from "@/types";
import { WORKABLE_LANE_COUNT } from "../sources/ats/workable";

const baseCompany: ATSConfig = {
  name: "Acme",
  slug: "acme",
  country: "US",
  countryFlag: "🇺🇸",
  ats: "workable",
};

function mockListResponse(jobs: unknown[] = []) {
  return {
    status: 200,
    ok: true,
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify({ jobs }),
  };
}

// Fake timers: these tests assert on the lane pool's *logical* behavior (how
// many requests are ever in flight at once, does a 429 retry) not on literal
// wall-clock duration. vi.advanceTimersByTimeAsync proves concurrency bounds
// deterministically regardless of Math.random()'s stagger draw each run.
// ADVANCE_MS is a generous upper bound on any test's worst-case total queued
// delay across all lanes.
const ADVANCE_MS = 40_000;

describe("Workable fetcher rate-limit handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("caps concurrent list-call requests at the lane count across mixed local/global companies", async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        return new Promise((resolve) => {
          setTimeout(() => {
            active -= 1;
            resolve(mockListResponse());
          }, 5000); // long enough in-flight window to guarantee lane overlap is observed
        });
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");

    // 6 companies, mixed modes — more than WORKABLE_LANE_COUNT, so this only
    // stays safe if concurrency is bounded by the lane pool rather than by
    // (accidentally) how many modes happen to be in play.
    const pending = Promise.all([
      fetchWorkable({ ...baseCompany, slug: "local-1" }, "local"),
      fetchWorkable({ ...baseCompany, slug: "local-2" }, "local"),
      fetchWorkable({ ...baseCompany, slug: "local-3" }, "local"),
      fetchWorkable({ ...baseCompany, slug: "global-1" }, "global"),
      fetchWorkable({ ...baseCompany, slug: "global-2" }, "global"),
      fetchWorkable({ ...baseCompany, slug: "global-3" }, "global"),
    ]);
    await vi.advanceTimersByTimeAsync(ADVANCE_MS);
    await pending;

    expect(maxActive).toBeGreaterThan(1); // real concurrency — not the old one-at-a-time queue
    expect(maxActive).toBeLessThanOrEqual(WORKABLE_LANE_COUNT); // still bounded — not an unstaggered burst
  });

  it("caps concurrent detail-page requests for a single company at the lane count", async () => {
    let active = 0;
    let maxActive = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        const isDetail = url.includes("/jobs/");
        return new Promise((resolve) => {
          setTimeout(() => {
            active -= 1;
            resolve(
              isDetail
                ? { status: 200, ok: true, headers: new Headers(), json: async () => ({}) }
                : mockListResponse(
                    Array.from({ length: 5 }, (_, i) => ({
                      shortcode: `job-${i}`,
                      title: `Role ${i}`,
                      description: "",
                    })),
                  ),
            );
          }, 5000);
        });
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    const pending = fetchWorkable({ ...baseCompany, slug: "many-jobs-co" }, "local");
    await vi.advanceTimersByTimeAsync(ADVANCE_MS);
    await pending;

    expect(maxActive).toBeGreaterThan(1); // detail fetches actually overlap now
    expect(maxActive).toBeLessThanOrEqual(WORKABLE_LANE_COUNT); // but never more than the lane pool allows
  });

  it("stops fetching detail pages for later batches once the slug gets blocked mid-fanout", async () => {
    let detailFetchCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const isDetail = url.includes("/jobs/");
        if (isDetail) detailFetchCount += 1;
        if (isDetail) {
          // Every detail call 429s, forever — the exact "flaky ATS" shape
          // from the live incident.
          return Promise.resolve({ status: 429, ok: false, headers: new Headers() });
        }
        // 15 jobs, more than WORKABLE_LANE_COUNT/pLimit's batch size of 5,
        // so this only stays cheap if later batches short-circuit.
        return Promise.resolve(
          mockListResponse(
            Array.from({ length: 15 }, (_, i) => ({
              shortcode: `job-${i}`,
              title: `Role ${i}`,
              description: "",
            })),
          ),
        );
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    const pending = fetchWorkable({ ...baseCompany, slug: "always-429-co" }, "local");
    await vi.advanceTimersByTimeAsync(300_000); // past every ceiling/backoff this can hit
    await pending;

    // Without the same-run block, 15 jobs each independently retrying to
    // the ceiling would mean detail fetch attempts scale with job count.
    // With it, only the first batch (≤5, times a few retries) ever calls
    // fetch — the remaining ~10 jobs short-circuit via isWorkableBlocked.
    expect(detailFetchCount).toBeLessThan(15 * 2);
  });

  it("retries a 429 on the list endpoint instead of giving up immediately", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({ status: 429, ok: false, headers: new Headers() });
        }
        return Promise.resolve(mockListResponse());
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    const pending = fetchWorkable({ ...baseCompany, slug: "flaky-co" }, "local");
    await vi.advanceTimersByTimeAsync(ADVANCE_MS);
    const result = await pending;

    // Old behavior: first 429 on the list call was terminal — error:
    // "HTTP 429", jobs: []. New behavior: retries and succeeds.
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  });

  // Regression test for the secondary finding in
  // issue-52-504-recurrence-part5: resolveJobDescription used to treat any
  // non-2xx detail response identically, so a 429 that exhausted retries
  // read as "dead/removed link" in the warning message — indistinguishable
  // from a real 404/410. The two now get split out.
  it("distinguishes a rate-limited detail fetch (429 exhausted) from a genuine dead link (404) in the warning", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (!url.includes("/jobs/")) {
          return Promise.resolve(
            mockListResponse([
              { shortcode: "dead-job", title: "Dead Job", description: "" },
              { shortcode: "throttled-job", title: "Throttled Job", description: "" },
            ]),
          );
        }
        if (url.includes("dead-job")) {
          return Promise.resolve({ status: 404, ok: false, headers: new Headers() });
        }
        // throttled-job always 429s — exhausts retries, same as the live incident.
        return Promise.resolve({ status: 429, ok: false, headers: new Headers() });
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    const pending = fetchWorkable({ ...baseCompany, slug: "mixed-failures-co" }, "local");
    await vi.advanceTimersByTimeAsync(300_000); // past every retry/backoff/ceiling
    const result = await pending;

    expect(result.warnings).toEqual([
      "2/2 job detail fetches failed (1 rate-limited, 1 dead/removed links) — used list description as fallback",
    ]);
  });
});
