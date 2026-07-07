// src/lib/__tests__/teamtailor-shape-guard.test.ts
//
// Yodo1's Teamtailor board (issue-52-429-404-followup-part3.md) returned
// HTTP 200, content-type application/json, and a body that parsed fine but
// had no `data` array — the old code did `const { data } = await res.json()`
// then `data.length`, which crashed with `TypeError: Cannot read properties
// of undefined (reading 'length')`. safeFetchJson's content-type/parse check
// doesn't catch this on its own, since the body IS valid JSON — this guards
// the shape explicitly. This test fails if that guard is ever removed or
// loosened.
import { describe, it, expect, vi, afterEach } from "vitest";
import type { ATSConfig } from "@/types";

const baseCompany: ATSConfig = {
  name: "Yodo1",
  slug: "yodo1",
  country: "US",
  countryFlag: "🇺🇸",
  ats: "teamtailor",
};

function mockJsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    text: async () => JSON.stringify(body),
  };
}

describe("fetchTeamtailor — response-shape guard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a clean error instead of crashing when valid JSON has no `data` array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockJsonResponse({ meta: { ok: true } })));

    const { fetchTeamtailor } = await import("../sources/ats/teamtailor");
    const result = await fetchTeamtailor(baseCompany, "global");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Unexpected response shape: missing `data` array");
    expect(result.jobs).toEqual([]);
  });

  it("still processes jobs normally when `data` is a proper array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockJsonResponse({
          data: [
            {
              id: "1",
              attributes: {
                title: "Engineer",
                "location-name": "Remote",
                "external-url": "https://example.com/jobs/1",
                "published-at": "2026-01-01",
                "body-html": "<p>desc</p>",
              },
            },
          ],
        }),
      ),
    );

    const { fetchTeamtailor } = await import("../sources/ats/teamtailor");
    const result = await fetchTeamtailor(baseCompany, "global");

    expect(result.ok).toBe(true);
    expect(result.rawCount).toBe(1);
    expect(result.jobs).toHaveLength(1);
  });
});
