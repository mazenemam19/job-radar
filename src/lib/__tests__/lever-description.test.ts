// Lever places requirements in `lists` for boards such as ResearchGate.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ATSConfig } from "@/types";

const company: ATSConfig = {
  name: "Acme",
  slug: "acme",
  country: "Germany",
  countryFlag: "🇩🇪",
  ats: "lever",
};

describe("fetchLever requirements", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes requirement lists in the stored job description", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        text: async () =>
          JSON.stringify([
            {
              id: "posting-1",
              text: "Senior Frontend Engineer",
              categories: { location: "Berlin" },
              hostedUrl: "https://jobs.lever.co/acme/posting-1",
              createdAt: 1_793_491_200_000,
              description: "<p>Introductory company text.</p>",
              lists: [
                {
                  text: "Requirements",
                  content: "<p>Build interfaces with TypeScript and React.</p>",
                },
              ],
            },
          ]),
      }),
    );

    const { fetchLever } = await import("../sources/ats/lever");
    const result = await fetchLever(company, "global");

    expect(result.ok).toBe(true);
    expect(result.jobs[0].description).toContain("TypeScript and React");
  });
});
