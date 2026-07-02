// src/lib/__tests__/workable-rate-limit.test.ts
// Regression guard for the July 2 incident: every 429 in both post-fix cron
// runs was a Workable company (see cron_logs_v2), not Greenhouse/Lever/
// Ashby/SmartRecruiters — afba5dc (the "fix rate-limit ATS fetchers" commit)
// never touched workable.ts, and workable.ts had two of its own bugs:
//   1. The queue was keyed by JobMode, so a "local" fetch and a "global"
//      fetch could hit apply.workable.com at the exact same instant.
//   2. The detail-page loop bypassed the queue entirely (raw fetch, only a
//      concurrency cap, no stagger, no retry).
import { describe, it, expect, vi, afterEach } from "vitest";
import type { ATSConfig } from "@/types";

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
    headers: new Headers(),
    json: async () => ({ jobs }),
  };
}

describe("Workable fetcher rate-limit handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not fire local-mode and global-mode requests concurrently on apply.workable.com", async () => {
    const callTimestamps: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callTimestamps.push(Date.now());
        return Promise.resolve(mockListResponse());
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");

    // Old behavior: these hit two independent per-mode queues and could
    // fire within milliseconds of each other despite both being
    // apply.workable.com. New behavior: one shared host queue, so the
    // second call waits behind the first.
    await Promise.all([
      fetchWorkable({ ...baseCompany, slug: "local-co" }, "local"),
      fetchWorkable({ ...baseCompany, slug: "global-co" }, "global"),
    ]);

    expect(callTimestamps).toHaveLength(2);
    const spread = Math.max(...callTimestamps) - Math.min(...callTimestamps);
    expect(spread).toBeGreaterThan(1000); // min stagger is 1500ms
  }, 15_000); // real 1500ms stagger + overhead can exceed vitest's default 5s test timeout under load

  it("queues and staggers detail-page requests instead of firing them unqueued", async () => {
    const callTimestamps: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        callTimestamps.push(Date.now());
        if (url.includes("/jobs/")) {
          return Promise.resolve({
            status: 200,
            ok: true,
            headers: new Headers(),
            json: async () => ({}),
          });
        }
        return Promise.resolve(
          mockListResponse(
            Array.from({ length: 4 }, (_, i) => ({
              shortcode: `job-${i}`,
              title: `Role ${i}`,
              description: "",
            })),
          ),
        );
      }),
    );

    const { fetchWorkable } = await import("../sources/ats/workable");
    await fetchWorkable({ ...baseCompany, slug: "many-jobs-co" }, "local");

    // 1 list call + 4 detail calls = 5 total, all through the same queue.
    expect(callTimestamps).toHaveLength(5);
    const spread = Math.max(...callTimestamps) - Math.min(...callTimestamps);
    // Old behavior: the 4 detail calls fired essentially at once (only a
    // pLimit(5) concurrency cap, no stagger). New behavior: every one of
    // them queues behind the list call and each other.
    expect(spread).toBeGreaterThan(4000); // 4 queued gaps, min 1500ms each
  }, 15_000);

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
    const result = await fetchWorkable({ ...baseCompany, slug: "flaky-co" }, "local");

    // Old behavior: first 429 on the list call was terminal — error:
    // "HTTP 429", jobs: []. New behavior: retries and succeeds.
    expect(calls).toBe(2);
    expect(result.ok).toBe(true);
  }, 15_000);
});
