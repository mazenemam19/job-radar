// src/lib/__tests__/job-display.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatRelativeDate, formatPostedLabel } from "../job-display";

const NOW = new Date("2025-06-01T12:00:00Z").getTime();

describe("formatRelativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Unknown' for an unparseable date", () => {
    expect(formatRelativeDate("not-a-date")).toBe("Unknown");
  });

  it("returns 'Today' for the current moment", () => {
    expect(formatRelativeDate(new Date(NOW).toISOString())).toBe("Today");
  });

  it("returns 'Yesterday' for 1 day ago", () => {
    expect(formatRelativeDate(new Date(NOW - 86_400_000).toISOString())).toBe("Yesterday");
  });

  it("returns '<n>d ago' under a week", () => {
    expect(formatRelativeDate(new Date(NOW - 3 * 86_400_000).toISOString())).toBe("3d ago");
  });

  it("returns '<n>w ago' under a month", () => {
    expect(formatRelativeDate(new Date(NOW - 14 * 86_400_000).toISOString())).toBe("2w ago");
  });

  it("returns '<n>mo ago' at 30+ days", () => {
    expect(formatRelativeDate(new Date(NOW - 60 * 86_400_000).toISOString())).toBe("2mo ago");
  });
});

describe("formatPostedLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses formatRelativeDate on posted_at when the date is known", () => {
    const job = {
      date_unknown: false,
      fetched_at: new Date(NOW).toISOString(),
      posted_at: new Date(NOW - 86_400_000).toISOString(),
    };
    expect(formatPostedLabel(job)).toBe("Yesterday");
  });

  it("falls back to an approximate fetched_at age when date is unknown", () => {
    const job = {
      date_unknown: true,
      fetched_at: new Date(NOW - 5 * 86_400_000).toISOString(),
      posted_at: new Date(NOW).toISOString(), // ignored — must not be used
    };
    expect(formatPostedLabel(job)).toBe("~5d ago (date unknown)");
  });
});
