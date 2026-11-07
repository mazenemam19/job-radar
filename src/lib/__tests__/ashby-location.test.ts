// Regression coverage for Ashby's current public API shape. The board returns
// `location`, not the historical `locationName` field.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ATSConfig } from "@/types";

const company: ATSConfig = {
  name: "Acme",
  slug: "acme",
  country: "United Kingdom",
  countryFlag: "🇬🇧",
  ats: "ashby",
};

describe("fetchAshby location normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Ashby's current location field instead of the employer country", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify({
            jobs: [
              {
                id: "posting-1",
                title: "Frontend Engineer",
                location: "Berlin",
                jobUrl: "https://jobs.ashbyhq.com/acme/posting-1",
                publishedAt: "2026-11-07T00:00:00Z",
                descriptionHtml: "<p>React and TypeScript</p>",
                employmentType: "FullTime",
                workplaceType: "Hybrid",
              },
            ],
          }),
      }),
    );

    const { fetchAshby } = await import("../sources/ats/ashby");
    const result = await fetchAshby(company, "global");

    expect(result.ok).toBe(true);
    expect(result.jobs[0]).toMatchObject({
      location: "Berlin",
      city: "Berlin",
      country: "Germany",
      countryCode: "DE",
      countryFlag: "🇩🇪",
      workplaceType: "hybrid",
      employmentTypes: ["full_time"],
    });
  });
});
