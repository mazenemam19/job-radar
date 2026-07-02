// src/lib/__tests__/ats-utils-rate-limit.test.ts
// Regression guard for issue #52 (ATS 429s): safeFetch() used to fire every
// request the instant it was called, with no host awareness and no retry.
// A burst of companies on the same shared-host ATS (Greenhouse, Lever,
// Ashby, SmartRecruiters) could all hit that host simultaneously — the
// exact pattern that trips a shared API's rate limiter. These tests prove
// the fix mechanically instead of relying on a live cron run against a
// real ATS to "probably" show fewer 429s.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

  it("staggers concurrent requests to the same host instead of firing them all at once", async () => {
    const callTimestamps: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callTimestamps.push(Date.now());
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers(),
          json: async () => ({}),
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
    await vi.runAllTimersAsync();
    await pending;

    expect(callTimestamps).toHaveLength(5);
    const spread = Math.max(...callTimestamps) - Math.min(...callTimestamps);
    // Old behavior: all 5 fire within ~0ms of each other. New behavior: each
    // queued request waits 200-600ms behind the previous one on that host,
    // so 5 requests should span at least ~4 stagger intervals.
    expect(spread).toBeGreaterThan(400);
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
