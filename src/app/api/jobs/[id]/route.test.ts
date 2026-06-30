// src/app/api/jobs/[id]/route.test.ts
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
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
}

const mockUser = { id: "user-123", email: "test@example.com" };
const mockJobs = [
  { id: "job_abc", title: "Senior Engineer", score: 85, gemini_reviewed: true },
  { id: "job_def", title: "Junior Dev", score: 42, gemini_reviewed: false },
];

describe("GET /api/jobs/[id]", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    const { GET } = await import("./route");
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("@/lib/supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/jobs/job_abc");
    const res = await GET(req as unknown as NextRequest, { params: { id: "job_abc" } });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 40 found in user cache", async () => {
    mockServerDb.from.mockReturnValue(mockQuery({ jobs: mockJobs }));

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/jobs/nonexistent");
    const res = await GET(req as unknown as NextRequest, { params: { id: "nonexistent" } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it("returns 200 with the job when found", async () => {
    mockServerDb.from.mockReturnValue(mockQuery({ jobs: mockJobs }));

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/jobs/job_abc");
    const res = await GET(req as unknown as NextRequest, { params: { id: "job_abc" } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("job_abc");
    expect(body.data.title).toBe("Senior Engineer");
  });

  it("returns 404 when user cache is empty", async () => {
    mockServerDb.from.mockReturnValue(mockQuery({ jobs: [] }));

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/jobs/job_abc");
    const res = await GET(req as unknown as NextRequest, { params: { id: "job_abc" } });

    expect(res.status).toBe(404);
  });

  it("returns 404 when user has no cache row at all", async () => {
    mockServerDb.from.mockReturnValue(mockQuery({ jobs: null }));

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/jobs/job_abc");
    const res = await GET(req as unknown as NextRequest, { params: { id: "job_abc" } });

    expect(res.status).toBe(404);
  });
});
