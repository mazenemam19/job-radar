// src/lib/__tests__/salary-route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Mock Supabase clients ──────────────────────────────────────

const mockServerDb = { from: vi.fn() };

vi.mock("../supabase/server", () => ({
  createServerClient: () => mockServerDb,
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

// ── Helpers ──────────────────────────────────────────────────

function mockQuery(returnData: unknown, returnError: unknown = null) {
  const chain: Record<string, unknown> = {
    error: returnError,
    data: returnData,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData, error: returnError }),
    insert: vi.fn().mockReturnThis(),
  };
  return chain;
}

const mockUser = { id: "user-123", email: "user@example.com" };

// ── Tests ─────────────────────────────────────────────────────

describe("GET /api/salary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary");
    const res = await GET(req as unknown as NextRequest);

    expect(res.status).toBe(401);
  });

  it("returns aggregated salary data", async () => {
    const rows = [
      {
        role_title: "Frontend Engineer",
        years_experience: 3,
        currency: "EGP",
        salary_egp: 30000,
        salary_usd: null,
        pipeline: "local",
      },
      {
        role_title: "Frontend Engineer",
        years_experience: 4,
        currency: "EGP",
        salary_egp: 40000,
        salary_usd: null,
        pipeline: "local",
      },
    ];
    mockServerDb.from.mockReturnValue(mockQuery(rows));

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary");
    const res = await GET(req as unknown as NextRequest);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0]).toHaveProperty("median");
    expect(json.data[0]).toHaveProperty("min");
    expect(json.data[0]).toHaveProperty("max");
    expect(json.data[0]).toHaveProperty("count");
  });

  it("strips % wildcard from role filter (ilike injection guard)", async () => {
    const rows: never[] = [];
    const queryMock = mockQuery(rows);
    mockServerDb.from.mockReturnValue(queryMock);

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary?role=%");
    await GET(req as unknown as NextRequest);

    // % is stripped → ilike '%' matches nothing (not everything)
    expect(queryMock.ilike).toHaveBeenCalledWith("role_title", "%%");
  });

  it("strips _ wildcard from role filter (ilike injection guard)", async () => {
    const rows: never[] = [];
    const queryMock = mockQuery(rows);
    mockServerDb.from.mockReturnValue(queryMock);

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary?role=_");
    await GET(req as unknown as NextRequest);

    // _ is stripped → ilike '%' instead of '%_%'
    expect(queryMock.ilike).toHaveBeenCalledWith("role_title", "%%");
  });

  it("filters by pipeline when provided", async () => {
    const rows = [
      {
        role_title: "Engineer",
        years_experience: 4,
        currency: "EGP",
        salary_egp: 30000,
        salary_usd: null,
        pipeline: "global",
      },
      {
        role_title: "Engineer",
        years_experience: 5,
        currency: "EGP",
        salary_egp: 40000,
        salary_usd: null,
        pipeline: "global",
      },
    ];
    const queryMock = mockQuery(rows);
    mockServerDb.from.mockReturnValue(queryMock);

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary?pipeline=global");
    await GET(req as unknown as NextRequest);

    expect(queryMock.eq).toHaveBeenCalledWith("pipeline", "global");
  });

  // I4: Single-row groups are suppressed (privacy: need 2+ to aggregate)
  it("suppresses aggregation groups with fewer than 2 entries", async () => {
    const rows = [
      {
        role_title: "Rare Role",
        years_experience: 3,
        currency: "EGP",
        salary_egp: 99999,
        salary_usd: null,
        pipeline: "local",
      },
    ];
    mockServerDb.from.mockReturnValue(mockQuery(rows));

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary");
    const res = await GET(req as unknown as NextRequest);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toEqual([]); // single entry → suppressed
  });

  // I5: Supabase error → 500
  it("returns 500 when Supabase query fails", async () => {
    mockServerDb.from.mockReturnValue(mockQuery(null, { message: "connection reset" }));

    const { GET } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary");
    const res = await GET(req as unknown as NextRequest);

    expect(res.status).toBe(500);
  });
});

describe("POST /api/salary", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({ role_title: "Dev", years_experience: 3, currency: "EGP" }),
    });
    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({ role_title: "Dev" }),
    });
    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid currency", async () => {
    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({ role_title: "Dev", years_experience: 3, currency: "BTC" }),
    });
    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(400);
  });

  it("returns 201 and inserts a valid report", async () => {
    const insertedRow = {
      id: "r1",
      user_id: "user-123",
      role_title: "Frontend Engineer",
      years_experience: 4,
      currency: "EGP",
      salary_egp: 35000,
      salary_usd: null,
      employment_type: null,
      work_arrangement: null,
      pipeline: null,
      reported_at: "2025-06-01T00:00:00Z",
      last_updated_at: "2025-06-01T00:00:00Z",
    };
    const queryMock = mockQuery(insertedRow);
    mockServerDb.from.mockReturnValue(queryMock);

    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({
        role_title: "Frontend Engineer",
        years_experience: 4,
        currency: "EGP",
        salary_egp: 35000,
      }),
    });
    const res = await POST(req as unknown as NextRequest);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.data.role_title).toBe("Frontend Engineer");
  });

  // I2: Verify role_title is trimmed before insert
  it("trims whitespace from role_title before insert", async () => {
    const insertedRow = {
      id: "r1",
      user_id: "user-123",
      role_title: "Frontend Engineer",
      years_experience: 4,
      currency: "EGP",
      salary_egp: 35000,
      salary_usd: null,
      employment_type: null,
      work_arrangement: null,
      pipeline: null,
      reported_at: "2025-06-01T00:00:00Z",
      last_updated_at: "2025-06-01T00:00:00Z",
    };
    const queryMock = mockQuery(insertedRow);
    mockServerDb.from.mockReturnValue(queryMock);

    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({
        role_title: "  Frontend Engineer  ",
        years_experience: 4,
        currency: "EGP",
        salary_egp: 35000,
      }),
    });
    const res = await POST(req as unknown as NextRequest);
    const json = await res.json();

    expect(res.status).toBe(201);
    // The route trims role_title before insert
    expect(json.data.role_title).toBe("Frontend Engineer");
  });

  // I3: Invalid JSON body → 400
  it("returns 400 for invalid JSON body", async () => {
    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: "not valid json {{{",
    });
    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });

  it("returns 500 when Supabase insert fails", async () => {
    mockServerDb.from.mockReturnValue(mockQuery(null, { message: "connection reset" }));

    const { POST } = await import("../../app/api/salary/route");
    const req = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({
        role_title: "Frontend Engineer",
        years_experience: 4,
        currency: "EGP",
        salary_egp: 35000,
      }),
    });
    const res = await POST(req as unknown as NextRequest);

    expect(res.status).toBe(500);
  });
});
