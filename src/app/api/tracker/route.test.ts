// src/app/api/tracker/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const mockServerDb = { from: vi.fn() };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => mockServerDb,
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

function mockQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {
    data,
    error,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    onConflict: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

const mockUser = { id: "user-123", email: "test@example.com" };
const mockEntries = [
  { id: "t1", job_id: "job_a", status: "applied", user_id: "user-123" },
  { id: "t2", job_id: "job_b", status: "saved", user_id: "user-123" },
];

describe("GET /api/tracker", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(401);
  });

  it("returns 200 with entries when authenticated", async () => {
    mockServerDb.from.mockReturnValue(mockQuery(mockEntries));

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toEqual(mockEntries);
  });

  it("returns 500 when db error occurs", async () => {
    mockServerDb.from.mockReturnValue(mockQuery(null, { message: "connection failed" }));

    const { GET } = await import("./route");
    const res = await GET();

    expect(res.status).toBe(500);
  });
});

describe("POST /api/tracker", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: JSON.stringify({ job_id: "x", job_snapshot: {} }),
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when job_id is missing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: JSON.stringify({ job_snapshot: {} }),
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when job_snapshot is missing", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: JSON.stringify({ job_id: "job_x" }),
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("defaults status to 'saved' when not provided or invalid", async () => {
    const query = mockQuery({ id: "new-entry" });
    mockServerDb.from.mockReturnValue(query);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: JSON.stringify({ job_id: "job_x", job_snapshot: { title: "Test" }, status: "invalid-status" }),
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(200);
  });

  it("accepts a valid status", async () => {
    const query = mockQuery({ id: "new-entry" });
    mockServerDb.from.mockReturnValue(query);

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: JSON.stringify({ job_id: "job_x", job_snapshot: { title: "Test" }, status: "applied" }),
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("returns 500 when db upsert fails", async () => {
    mockServerDb.from.mockReturnValue(mockQuery(null, { message: "unique constraint" }));

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/tracker", {
      method: "POST",
      body: JSON.stringify({ job_id: "job_x", job_snapshot: {} }),
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(500);
  });
});
