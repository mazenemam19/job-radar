// src/lib/__tests__/ats-utils-rate-limit.test.ts
// Regression guard for issue #52 (ATS 429s): safeFetch() used to fire every
// request the instant it was called, with no host awareness and no retry.
// A burst of companies on the same shared-host ATS (Greenhouse, Lever,
// Ashby, SmartRecruiters) could all hit that host simultaneously — the
// exact pattern that trips a shared API's rate limiter. These tests prove
// the fix mechanically instead of relying on a live cron run against a
// real ATS to "probably" show fewer 429s.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HOST_LANE_COUNT } from "../sources/ats/http";

describe("safeFetch rate-limit handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("retries on 429 and returns the eventual successful response", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({ status: 429, ok: false, headers: new Headers() });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({}),
        });
      }),
    );

    const { safeFetch } = await import("../sources/ats-utils");
    const pending = safeFetch("https://boards-api.greenhouse.io/v1/boards/acme/jobs");
    await vi.runAllTimersAsync();
    const res = await pending;

    expect(calls).toBe(2); // first call 429'd, second (retry) succeeded
    expect(res?.status).toBe(200);
  });

  it("gives up after MAX_429_RETRIES instead of retrying forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ status: 429, ok: false, headers: new Headers() }),
    );

    const { safeFetch } = await import("../sources/ats-utils");
    const pending = safeFetch("https://boards-api.greenhouse.io/v1/boards/always-429/jobs");
    await vi.runAllTimersAsync();
    const res = await pending;

    // 1 initial attempt + MAX_429_RETRIES(3) retries = 4 total calls, then give up.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
    expect(res?.status).toBe(429);
  });

  it("honors a Retry-After longer than the old 15s cap, up to the new cap", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls === 1) {
          return Promise.resolve({
            status: 429,
            ok: false,
            headers: new Headers({ "retry-after": "20" }), // > old 15s cap, < new 30s cap
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({}),
        });
      }),
    );

    const { safeFetch } = await import("../sources/ats-utils");
    const start = Date.now();
    const pending = safeFetch("https://boards-api.greenhouse.io/v1/boards/slow-limiter/jobs");
    await vi.runAllTimersAsync();
    const res = await pending;
    const elapsed = Date.now() - start;

    expect(res?.status).toBe(200);
    // Retry-After said 20s — the old code would've capped the wait at 15s
    // and retried early. This should wait out close to the full 20s.
    expect(elapsed).toBeGreaterThanOrEqual(19_000);
  });

  it("bounds concurrency to HOST_LANE_COUNT instead of fully serializing every request", async () => {
    // Regression guard for the 504 that came back after Part A: this test
    // used to assert `spread > 400` for 5 requests to the same host — i.e.
    // it defined "correct" as "fully serial, one at a time." That's the same
    // shape of bug workable.ts had before its own lane-pool fix. A host
    // queue that's fully serial scales wall-clock time linearly with total
    // request count across every company sharing that host — exactly what
    // caused the Workable 504, just never fixed here. This test instead
    // proves real (but bounded) concurrency is achieved: more than 1 request
    // in flight at once, never more than HOST_LANE_COUNT.
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
            resolve({
              status: 200,
              ok: true,
              headers: new Headers(),
              json: async () => ({}),
            });
          }, 5000); // long enough in-flight window to overlap across lanes
        });
      }),
    );

    const { safeFetch } = await import("../sources/ats-utils");
    const host = "boards-api.greenhouse.io";

    // Simulates the exact scenario that caused issue #52: several companies
    // on the same ATS host, all kicked off by the runner at once.
    const pending = Promise.all(
      Array.from({ length: 5 }, (_, i) => safeFetch(`https://${host}/v1/boards/company-${i}/jobs`)),
    );
    await vi.advanceTimersByTimeAsync(40_000);
    await pending;

    expect(maxActive).toBeGreaterThan(1); // real concurrency achieved
    expect(maxActive).toBeLessThanOrEqual(HOST_LANE_COUNT); // still bounded, not an unstaggered burst
  });

  it("gives up on a single request before it can burn through the whole retry budget", async () => {
    // Regression guard for the 504 that came back after Part A + Part B:
    // neither of those touched what happens once a request is already
    // in-flight and retrying. Without a total-time ceiling, one host stuck
    // returning 429 could hold its lane for close to the full theoretical
    // worst case (~270s), and everything queued behind it in that lane
    // waits the whole time regardless of any dispatch-level deadline.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
        headers: new Headers({ "retry-after": "40" }), // > RETRY_BACKOFF_CAP_MS(30s), forces the cap every time
      }),
    );

    const { safeFetch } = await import("../sources/ats-utils");
    const pending = safeFetch("https://boards-api.greenhouse.io/v1/boards/stuck-host/jobs");
    await vi.runAllTimersAsync();
    const res = await pending;

    // Each backoff is capped at 30s. Two backoffs (60s) plus fetch time
    // already exceeds the 90s ceiling on the third — so it gives up instead
    // of taking the full 4-attempt, ~120s+ retry budget.
    expect(vi.mocked(fetch).mock.calls.length).toBeLessThan(4);
    expect(res?.status).toBe(429); // still returns the real last response, not null
  });

  it("does not make unrelated hosts wait behind a different host's queue", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers(),
        json: async () => ({}),
      }),
    );

    const { safeFetch } = await import("../sources/ats-utils");

    const start = Date.now();
    const p1 = safeFetch("https://boards-api.greenhouse.io/v1/boards/acme/jobs");
    await vi.runAllTimersAsync();
    await p1;
    const p2 = safeFetch("https://api.lever.co/v0/postings/other-co");
    await vi.runAllTimersAsync();
    await p2;
    const elapsed = Date.now() - start;

    // Two different hosts, run sequentially here — each pays its own stagger
    // (max 600ms) but they don't compound into one shared queue's delay.
    expect(elapsed).toBeLessThan(1500);
  });
});
