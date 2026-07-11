// src/lib/__tests__/admin-companies-update.test.ts
// Covers PUT /api/admin/companies/[id], in particular the merge-aware
// pipeline-required check: a partial patch (e.g. just { is_active: true })
// has to be validated against the row it would produce, not just the fields
// present in the request body.

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
    update: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
  };
  return chain;
}

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/companies/abc-123", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

async function callPut(body: unknown) {
  const { PUT } = await import("../../app/api/admin/companies/[id]/route");
  return PUT(makeRequest(body), { params: { id: "abc-123" } });
}

describe("PUT /api/admin/companies/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 when user is not admin", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await callPut({ is_active: true });
    expect(res.status).toBe(403);
  });

  it("rejects a partial patch that would leave an active company with neither pipeline", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    // Current row already has both pipelines off (e.g. was created dead);
    // this patch only re-activates it without touching either pipeline.
    const currentRowQuery = mockQuery({
      pipeline_local: false,
      pipeline_global: false,
      is_active: false,
    });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" })) // requireAdmin
      .mockReturnValueOnce(currentRowQuery); // fetch current row

    const res = await callPut({ is_active: true });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("An active company needs at least one pipeline (local or global)");
  });

  it("rejects explicitly unchecking both pipelines on an active company", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    const currentRowQuery = mockQuery({
      pipeline_local: true,
      pipeline_global: false,
      is_active: true,
    });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(currentRowQuery);

    const res = await callPut({ pipeline_local: false, pipeline_global: false });
    expect(res.status).toBe(400);
  });

  it("allows deactivating a company without touching its pipelines", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    const currentRowQuery = mockQuery({
      pipeline_local: false,
      pipeline_global: false,
      is_active: true,
    });
    const updateQuery = mockQuery({ id: "abc-123", is_active: false });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(currentRowQuery)
      .mockReturnValueOnce(updateQuery);

    const res = await callPut({ is_active: false });
    expect(res.status).toBe(200);
  });

  it("allows the patch when the merged state still has a pipeline enabled", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-user" });

    const currentRowQuery = mockQuery({
      pipeline_local: true,
      pipeline_global: false,
      is_active: true,
    });
    const updateQuery = mockQuery({ id: "abc-123", name: "Acme Updated" });
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(mockQuery({ role: "admin" }))
      .mockReturnValueOnce(currentRowQuery)
      .mockReturnValueOnce(updateQuery);

    const res = await callPut({ name: "Acme Updated" });
    expect(res.status).toBe(200);
  });
});
