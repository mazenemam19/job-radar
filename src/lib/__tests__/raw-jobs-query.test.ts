import { describe, expect, it } from "vitest";
import { normalizeFilteredResult } from "../raw-jobs-query";

describe("normalizeFilteredResult", () => {
  it("keeps the legacy profile count as a location-stage fallback during migration", () => {
    const result = normalizeFilteredResult({
      jobs: [],
      funnel: {
        total_fetched: 100,
        after_date_filter: 60,
        after_settings_filter_coarse: 20,
      },
    });

    expect(result.funnel).toEqual({
      total_fetched: 100,
      after_date_filter: 60,
      after_workplace_filter: 60,
      after_employment_filter: 60,
      after_location_filter: 20,
    });
  });

  it("rejects malformed RPC results instead of producing an unusable pipeline log", () => {
    expect(() => normalizeFilteredResult({ jobs: [], funnel: null })).toThrow(
      "Profile jobs RPC returned an incomplete response",
    );
  });
});
