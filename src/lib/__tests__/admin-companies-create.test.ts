// src/lib/__tests__/admin-companies-create.test.ts
// Covers POST /api/admin/companies, in particular the pipeline-required
// check added alongside issue-52 act 7 (see fetch-jobs.ts's dispatch loop —
// a company with neither pipeline enabled gets zero fetch tasks queued,
// ever, with nothing logged).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockAdminDb = { from: vi.fn() };

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

vi.mock("../supabase/server", () => ({
  createServerClient: () => mockAdminDb,
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

function mockQuery(returnData: unknown, returnError: unknown = null) {
  const chain: Record<string, unknown> = {
    data: returnData,
    error: returnError,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  return chain;
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const validBody = {
  name: "Acme",
  ats: "greenhouse",
  slug: "acme",
  country: "EG",
  pipeline_local: true,
};

describe("POST /api/admin/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user is not admin", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("../../app/api/admin/companies/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 400 when neither pipeline is enabled", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });
    mockAdminDb.from = vi.fn().mockReturnValueOnce(mockQuery({ role: "admin" }));

    const { POST } = await import("../../app/api/admin/companies/route");
    const res = await POST(
      makeRequest({ name: "Acme", ats: "greenhouse", slug: "acme", country: "EG" }),
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("An active company needs at least one pipeline (local or global)");
  });

  it("allows neither pipeline when the company is created inactive", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });
    const insertQuery = mockQuery({ id: "co-1", ...validBody, is_active: false });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(insertQuery);

    const { POST } = await import("../../app/api/admin/companies/route");
    const res = await POST(
      makeRequest({
        name: "Acme",
        ats: "greenhouse",
        slug: "acme",
        country: "EG",
        is_active: false,
      }),
    );
    expect(res.status).toBe(201);
  });

  it("creates the company when pipeline_global alone is set", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });
    const insertQuery = mockQuery({ id: "co-1", ...validBody, pipeline_global: true });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(insertQuery);

    const { POST } = await import("../../app/api/admin/companies/route");
    const res = await POST(
      makeRequest({
        name: "Acme",
        ats: "greenhouse",
        slug: "acme",
        country: "EG",
        pipeline_global: true,
      }),
    );
    expect(res.status).toBe(201);
  });

  it("returns 201 when at least one pipeline is enabled", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });
    const insertQuery = mockQuery({ id: "co-1", ...validBody });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(insertQuery);

    const { POST } = await import("../../app/api/admin/companies/route");
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
  });
});
