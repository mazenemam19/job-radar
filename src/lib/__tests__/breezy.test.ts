// src/lib/__tests__/breezy.test.ts
// Regression guard for the Artefactual Systems Inc. incident (issue #52):
// a Cloudflare/WAF challenge page served with HTTP 200 used to crash
// fetchBreezy's `res.json()` call with a misleading "Parse Error". Since the
// migration to safeFetchJson, this must come back as a normal per-company
// error instead of a thrown exception.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ATSConfig } from "@/types";

const baseCompany: ATSConfig = {
  name: "Artefactual Systems Inc.",
  slug: "artefactual-systems",
  country: "CA",
  countryFlag: "🇨🇦",
  ats: "breezy",
};

describe("fetchBreezy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("returns processed jobs on a real JSON response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify([
            {
              id: "job-1",
              name: "Senior Frontend Engineer",
              location: { name: "Remote" },
              url: "https://artefactual-systems.breezy.hr/p/job-1",
              updated_at: "2026-07-01T00:00:00Z",
              description: "React and TypeScript",
            },
          ]),
      }),
    );

    const { fetchBreezy } = await import("../sources/ats/breezy");
    const pending = fetchBreezy(baseCompany, "global");
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.ok).toBe(true);
    expect(result.rawCount).toBe(1);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Senior Frontend Engineer");
  });

  it("reports a clean error instead of throwing on a 200 WAF/HTML challenge page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => "<!DOCTYPE html><html><body>Just a moment...</body></html>",
      }),
    );

    const { fetchBreezy } = await import("../sources/ats/breezy");
    const pending = fetchBreezy(baseCompany, "global");
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.jobs).toEqual([]);
    expect(result.error).toContain("Non-JSON response");
    expect(result.error).toContain("text/html");
  });

  it("reports HTTP status errors without touching the response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers() }),
    );

    const { fetchBreezy } = await import("../sources/ats/breezy");
    const pending = fetchBreezy(baseCompany, "global");
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result).toMatchObject({ ok: false, jobs: [], error: "HTTP 403" });
  });
});
