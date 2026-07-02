// src/lib/__tests__/dashboard-client.test.ts
// Covers the pure transforms behind DashboardClient: mode-count tallying and
// filtering the job feed by pipeline (audit row #14).

import { describe, it, expect } from "vitest";
import { computeModeCounts, filterJobsByMode } from "../dashboard-client";
import type { ScoredJob } from "../types";

function job(id: string, mode: "local" | "global"): ScoredJob {
  return { id, mode } as ScoredJob;
}

describe("computeModeCounts", () => {
  it("tallies jobs per mode", () => {
    const jobs = [job("1", "local"), job("2", "local"), job("3", "global")];
    expect(computeModeCounts(jobs)).toEqual({ local: 2, global: 1 });
  });

  it("returns an empty object for an empty feed", () => {
    expect(computeModeCounts([])).toEqual({});
  });
});

describe("filterJobsByMode", () => {
  const jobs = [job("1", "local"), job("2", "local"), job("3", "global")];

  it("returns every job when the mode is 'all'", () => {
    expect(filterJobsByMode(jobs, "all")).toEqual(jobs);
  });

  it("returns only jobs matching the given mode", () => {
    expect(filterJobsByMode(jobs, "global")).toEqual([job("3", "global")]);
  });

  it("returns an empty array when no job matches the mode", () => {
    expect(filterJobsByMode([job("1", "local")], "global")).toEqual([]);
  });
});
