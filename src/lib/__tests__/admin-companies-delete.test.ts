// src/lib/__tests__/admin-companies-delete.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Mock Supabase clients ──────────────────────────────────────

const mockAdminDb = {
  from: vi.fn(),
};

const mockServerDb = {
  from: vi.fn(),
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

vi.mock("../supabase/server", () => ({
  createServerClient: () => mockServerDb,
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

// Helper to create a mock Supabase query chain
// The chain is thenable so `await` resolves to { data, error } realistically.
function mockQuery(returnData: unknown, returnError: unknown = null) {
  const chain: Record<string, unknown> = {
    error: returnError,
    data: returnData,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    then: (onfulfilled: (val: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve({ data: returnData, error: returnError }).then(onfulfilled),
  };
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────

describe("DELETE /api/admin/companies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user is not admin", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { DELETE } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/123", { method: "DELETE" });
    const res = await DELETE(req as unknown as NextRequest, { params: { id: "123" } });
    expect(res.status).toBe(403);
  });

  it("deletes raw_jobs before deleting the company", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    // Mock user_profiles query (requireAdmin check)
    const adminQuery = mockQuery({ role: "admin" });

    // First call: select company (to get name + ats)
    // Second call: delete raw_jobs
    // Third call: delete company
    const companyQuery = mockQuery({ name: "Acme Corp", ats: "greenhouse" });
    const rawJobsDeleteQuery = mockQuery(null, null);
    const companyDeleteQuery = mockQuery(null, null);

    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(adminQuery) // user_profiles (requireAdmin)
      .mockReturnValueOnce(companyQuery) // select company
      .mockReturnValueOnce(rawJobsDeleteQuery) // delete raw_jobs
      .mockReturnValueOnce(companyDeleteQuery); // delete company

    const { DELETE } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/abc-123", { method: "DELETE" });
    const res = await DELETE(req as unknown as NextRequest, { params: { id: "abc-123" } });

    expect(res.status).toBe(200);

    // Verify raw_jobs was deleted with correct filters
    expect(mockAdminDb.from).toHaveBeenCalledWith("raw_jobs");
    const rawJobsCall = rawJobsDeleteQuery;
    expect(rawJobsCall.delete).toHaveBeenCalled();
    expect(rawJobsCall.eq).toHaveBeenCalledWith("ats_type", "greenhouse");
    expect(rawJobsCall.eq).toHaveBeenCalledWith("company", "Acme Corp");

    // Verify company was deleted
    expect(mockAdminDb.from).toHaveBeenCalledWith("ats_companies");
    expect(companyDeleteQuery.delete).toHaveBeenCalled();
    expect(companyDeleteQuery.eq).toHaveBeenCalledWith("id", "abc-123");
  });

  it("skips raw_jobs cleanup if company not found", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    // Call 1: user_profiles (requireAdmin)
    // Call 2: select company → null (not found)
    // Call 3: delete from ats_companies (still runs, just no-op for missing row)
    const companyQuery = mockQuery(null);
    const companyDeleteQuery = mockQuery(null, null);

    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(companyQuery)
      .mockReturnValueOnce(companyDeleteQuery);

    const { DELETE } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/ghost-id", { method: "DELETE" });
    const res = await DELETE(req as unknown as NextRequest, { params: { id: "ghost-id" } });

    // Deleting a non-existent company is idempotent → 200
    expect(res.status).toBe(200);
    // raw_jobs table should never have been touched (only 3 calls, no raw_jobs)
    const fromCalls = (mockAdminDb.from as ReturnType<typeof vi.fn>).mock.calls;
    const tablesCalled = fromCalls.map((c: string[]) => c[0]);
    expect(tablesCalled).not.toContain("raw_jobs");
  });

  it("returns 500 on DB error during company delete", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    const companyQuery = mockQuery({ name: "Acme Corp", ats: "greenhouse" });
    const rawJobsDeleteQuery = mockQuery(null, null);
    const companyDeleteQuery = mockQuery(null, { message: "connection reset" });

    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" })) // user_profiles (requireAdmin)
      .mockReturnValueOnce(companyQuery) // select company
      .mockReturnValueOnce(rawJobsDeleteQuery) // delete raw_jobs
      .mockReturnValueOnce(companyDeleteQuery); // delete company → fails

    const { DELETE } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/abc-123", { method: "DELETE" });
    const res = await DELETE(req as unknown as NextRequest, { params: { id: "abc-123" } });

    expect(res.status).toBe(500);
  });
});

describe("PUT /api/admin/companies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user is not admin", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { PUT } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/123", {
      method: "PUT",
      body: JSON.stringify({ name: "New Name" }),
    });
    const res = await PUT(req as unknown as NextRequest, { params: { id: "123" } });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    // requireAdmin: role check via adminDb
    mockAdminDb.from = vi.fn().mockReturnValueOnce(mockQuery({ role: "admin" })); // user_profiles (requireAdmin)

    const { PUT } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/123", {
      method: "PUT",
      body: "not json",
    });
    const res = await PUT(req as unknown as NextRequest, { params: { id: "123" } });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid ATS type", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    // requireAdmin: role check via adminDb
    mockAdminDb.from = vi.fn().mockReturnValueOnce(mockQuery({ role: "admin" })); // user_profiles (requireAdmin)

    const { PUT } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/123", {
      method: "PUT",
      body: JSON.stringify({ ats: "invalid_ats" }),
    });
    const res = await PUT(req as unknown as NextRequest, { params: { id: "123" } });
    expect(res.status).toBe(400);
  });

  it("updates company fields and returns 200", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    const updatedRow = {
      id: "comp-123",
      name: "Updated Corp",
      ats: "greenhouse",
      slug: "updated-corp",
      country: "US",
      is_active: true,
    };
    const updateQuery = mockQuery(updatedRow);

    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" })) // user_profiles (requireAdmin)
      .mockReturnValueOnce(updateQuery); // update company

    const { PUT } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/comp-123", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Corp", country: "US" }),
    });
    const res = await PUT(req as unknown as NextRequest, { params: { id: "comp-123" } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.name).toBe("Updated Corp");
    expect(updateQuery.update).toHaveBeenCalled();
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "comp-123");
  });

  it("returns 404 when company not found after update", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    const updateQuery = mockQuery(null, null); // no row returned → 404

    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(updateQuery);

    const { PUT } = await import("../../app/api/admin/companies/[id]/route");
    const req = new Request("http://localhost/api/admin/companies/ghost-id", {
      method: "PUT",
      body: JSON.stringify({ name: "Ghost" }),
    });
    const res = await PUT(req as unknown as NextRequest, { params: { id: "ghost-id" } });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.ok).toBe(false);
  });
});
