// src/lib/__tests__/run-state-workable-cooldown.test.ts
// Regression test for issue-52-504-recurrence-part4: markWorkable429 used to
// only add to an in-run set that gets flushed to the DB *after* the fetch
// phase ends, so isWorkableBlocked() stayed blind to a slug that had already
// 429'd for the rest of that same run. Every other detail-page request for
// that company kept independently re-discovering the same 429, each paying
// up to WORKABLE_MAX_TOTAL_FETCH_MS — see the doc for the live-log evidence
// (one company, 51 separate 429 sequences, 562s total).
import { describe, it, expect, afterEach, vi } from "vitest";

describe("Workable cooldown — same-run protection", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("isWorkableBlocked returns true immediately after markWorkable429, without waiting for a DB flush", async () => {
    const { markWorkable429, isWorkableBlocked } = await import("../sources/ats/run-state");

    expect(isWorkableBlocked("flaky-co")).toBe(false);
    markWorkable429("flaky-co");
    expect(isWorkableBlocked("flaky-co")).toBe(true);
  });

  it("does not block unrelated slugs", async () => {
    const { markWorkable429, isWorkableBlocked } = await import("../sources/ats/run-state");

    markWorkable429("flaky-co");
    expect(isWorkableBlocked("other-co")).toBe(false);
  });
});

describe("markWorkableSlugsBlocked24h — jittered expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  // Regression test for issue-52-504-recurrence-part5: this used to compute
  // ONE `until` timestamp and apply it to every slug in the batch, so a
  // group blocked together always came off cooldown together too, walking
  // straight back into the same thundering herd ~24h later. Each slug must
  // now land at its own point in [20h, 28h) instead of sharing one instant.
  it("gives each slug in the same batch a different expiry within [20h, 28h)", async () => {
    vi.useFakeTimers();
    const start = Date.now();
    vi.setSystemTime(start);

    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0); // slug-min -> exactly 20h
    randomSpy.mockReturnValueOnce(1); // slug-max -> exactly 28h

    const { markWorkableSlugsBlocked24h, isWorkableBlocked } =
      await import("../sources/ats/run-state");
    markWorkableSlugsBlocked24h(["slug-min", "slug-max"]);

    // Just past the 20h mark: the min-jitter slug's cooldown has expired,
    // but the max-jitter slug (28h) from the exact same batch call is still
    // blocked — proof the two didn't get the same flat expiry.
    vi.setSystemTime(start + 20 * 3600e3 + 1);
    expect(isWorkableBlocked("slug-min")).toBe(false);
    expect(isWorkableBlocked("slug-max")).toBe(true);

    // And the max-jitter slug does clear once its own (28h) window passes.
    vi.setSystemTime(start + 28 * 3600e3 + 1);
    expect(isWorkableBlocked("slug-max")).toBe(false);
  });
});
