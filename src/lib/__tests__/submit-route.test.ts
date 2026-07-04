// src/lib/__tests__/submit-route.test.ts
// Covers lib/submit-route.ts helpers (validateSubmitPost, countryFlag) and
// the POST /api/submit handler (audit row #20).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── lib/submit-route.ts — pure helpers ────────────────────────

import { validateSubmitPost, countryFlag } from "../submit-route";
import { VALID_ATS } from "../constants";

describe("validateSubmitPost", () => {
  const valid = {
    company_name: "Acme",
    ats_type: VALID_ATS[0],
    slug: "acme",
    country: "EG",
  };

  it("returns ok for a complete valid body", () => {
    expect(validateSubmitPost(valid)).toEqual({ ok: true });
  });

  it("rejects when company_name is missing", () => {
    const result = validateSubmitPost({ ...valid, company_name: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("company_name is required");
  });

  it("rejects when company_name is only whitespace", () => {
    const result = validateSubmitPost({ ...valid, company_name: "   " });
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid ats_type", () => {
    const result = validateSubmitPost({ ...valid, ats_type: "fakeats" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Invalid ats_type");
  });

  it("rejects when slug is missing", () => {
    const result = validateSubmitPost({ ...valid, slug: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("slug is required");
  });

  it("rejects when slug is only whitespace", () => {
    expect(validateSubmitPost({ ...valid, slug: "  " }).ok).toBe(false);
  });

  it("rejects when country is missing", () => {
    const result = validateSubmitPost({ ...valid, country: undefined });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("country is required");
  });

  it("accepts all entries in VALID_ATS", () => {
    for (const ats of VALID_ATS) {
      expect(validateSubmitPost({ ...valid, ats_type: ats }).ok).toBe(true);
    }
  });
});

describe("countryFlag", () => {
  it("returns the flag for a known country code", () => {
    // EG is in COUNTRY_FLAGS
    expect(countryFlag("EG")).not.toBe("🌍");
    expect(countryFlag("EG")).toMatch(/\p{Emoji}/u);
  });

  it("normalises lowercase country codes", () => {
    expect(countryFlag("eg")).toBe(countryFlag("EG"));
  });

  it("falls back to 🌍 for unknown codes", () => {
    expect(countryFlag("ZZ")).toBe("🌍");
  });
});

// ── POST /api/submit — route handler ──────────────────────────

const mockAdminDb = { from: vi.fn() };

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

function mockQuery(returnData: unknown, returnError: unknown = null) {
  const chain: Record<string, unknown> = {
    data: returnData,
    error: returnError,
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  return chain;
}

function makeRequest(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new Request("http://localhost/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("../../app/api/submit/route");
    const req = new Request("http://localhost/api/submit", {
      method: "POST",
      body: "not json {{{",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when company_name is missing", async () => {
    const { POST } = await import("../../app/api/submit/route");
    const res = await POST(makeRequest({ ats_type: VALID_ATS[0], slug: "acme", country: "EG" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("company_name is required");
  });

  it("returns 400 for invalid ats_type", async () => {
    const { POST } = await import("../../app/api/submit/route");
    const res = await POST(
      makeRequest({ company_name: "Acme", ats_type: "badats", slug: "acme", country: "EG" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid ats_type");
  });

  it("returns 400 when slug is missing", async () => {
    const { POST } = await import("../../app/api/submit/route");
    const res = await POST(
      makeRequest({ company_name: "Acme", ats_type: VALID_ATS[0], country: "EG" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when country is missing", async () => {
    const { POST } = await import("../../app/api/submit/route");
    const res = await POST(
      makeRequest({ company_name: "Acme", ats_type: VALID_ATS[0], slug: "acme" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 201 and the new submission id on success", async () => {
    mockAdminDb.from.mockReturnValue(mockQuery({ id: "sub-1" }));

    const { POST } = await import("../../app/api/submit/route");
    const res = await POST(
      makeRequest(
        {
          company_name: "Acme",
          ats_type: VALID_ATS[0],
          slug: "acme",
          country: "EG",
        },
        { "x-forwarded-for": "10.0.0.1" },
      ),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.id).toBe("sub-1");
  });

  it("returns 500 when Supabase insert fails", async () => {
    mockAdminDb.from.mockReturnValue(mockQuery(null, { message: "db error" }));

    const { POST } = await import("../../app/api/submit/route");
    const res = await POST(
      makeRequest(
        {
          company_name: "Acme",
          ats_type: VALID_ATS[0],
          slug: "acme",
          country: "EG",
        },
        { "x-forwarded-for": "10.0.0.2" },
      ),
    );
    expect(res.status).toBe(500);
  });
});
