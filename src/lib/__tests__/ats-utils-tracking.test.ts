// src/lib/__tests__/ats-utils-tracking.test.ts
// Regression guard for Finding E (feat/track-teamtailor-breezy-requests):
// fetchTeamtailor() and fetchBreezy() used to call raw fetch() directly,
// which meant they were invisible in domain_counts and had no rate-limiting
// of any kind, unlike every other ATS fetcher. This confirms both now route
// through safeFetch() and get tracked like the rest.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ATSConfig } from "@/types";

const mockDb = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockDb,
}));

const baseCompany: ATSConfig = {
  name: "Acme",
  country: "Egypt",
  countryFlag: "🇪🇬",
  city: "Cairo",
  ats: "teamtailor",
  slug: "acme",
};

describe("Teamtailor/Breezy domain_counts tracking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockDb.rpc.mockResolvedValue({ data: null, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tracks the teamtailor host via safeFetch instead of bypassing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) }),
    );

    const { fetchTeamtailor, flushDomainCountsToDB } = await import("../sources/ats-utils");
    await fetchTeamtailor(baseCompany, "global");
    await flushDomainCountsToDB();

    expect(mockDb.rpc).toHaveBeenCalledWith("increment_domain_counts", {
      increments: { "acme.teamtailor.com": 1 },
    });
  });

  it("tracks the breezy host via safeFetch instead of bypassing it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }),
    );

    const { fetchBreezy, flushDomainCountsToDB } = await import("../sources/ats-utils");
    await fetchBreezy({ ...baseCompany, ats: "breezy" }, "global");
    await flushDomainCountsToDB();

    expect(mockDb.rpc).toHaveBeenCalledWith("increment_domain_counts", {
      increments: { "acme.breezy.hr": 1 },
    });
  });
});
