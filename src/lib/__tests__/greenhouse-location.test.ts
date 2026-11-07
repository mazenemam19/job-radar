// Regression coverage for a common Greenhouse shape: the board exposes a
// `Remote` office but no structured workplace field on the posting itself.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ATSConfig } from "@/types";

const company: ATSConfig = {
  name: "Acme",
  slug: "acme",
  country: "FR",
  countryFlag: "🇫🇷",
  ats: "greenhouse",
};

describe("fetchGreenhouse location normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves a Remote office as a remote Germany posting", async () => {
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
                id: 1,
                title: "Frontend Engineer",
                location: { name: "Germany" },
                offices: [{ name: "Remote", location: null }],
                absolute_url: "https://boards.greenhouse.io/acme/jobs/1",
                updated_at: "2026-11-07T00:00:00Z",
                content: "<p>React and TypeScript</p>",
              },
            ],
          }),
      }),
    );

    const { fetchGreenhouse } = await import("../sources/ats/greenhouse");
    const result = await fetchGreenhouse(company, "local");

    expect(result.ok).toBe(true);
    expect(result.jobs[0]).toMatchObject({
      location: "Germany",
      countryCode: "DE",
      countryFlag: "🇩🇪",
      workplaceType: "remote",
      mode: "global",
      isRemote: true,
    });
  });
});
