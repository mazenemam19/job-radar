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
