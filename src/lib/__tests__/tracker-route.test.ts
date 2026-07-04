// src/lib/__tests__/tracker-route.test.ts
// Unit tests for lib/tracker-route.ts and PATCH/DELETE /api/tracker/[id]
// (audit row #22).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { buildTrackerPatch } from "../tracker-route";

// ── lib/tracker-route.ts — pure helpers ────────────────────────

describe("buildTrackerPatch", () => {
  const now = "2026-07-04T12:00:00.000Z";

  it("updates updated_at on every call", () => {
    const patch = buildTrackerPatch({}, now);
    expect(patch.updated_at).toBe(now);
  });

  it("includes valid status and sets last_status_change", () => {
    const patch = buildTrackerPatch({ status: "applied" }, now);
    expect(patch.status).toBe("applied");
    expect(patch.last_status_change).toBe(now);
  });

  it("ignores invalid status values", () => {
    const patch = buildTrackerPatch({ status: "non-existent-status" }, now);
    expect(patch.status).toBeUndefined();
    expect(patch.last_status_change).toBeUndefined();
  });

  it("accepts string notes and maps null/empty", () => {
    const patch1 = buildTrackerPatch({ notes: "Called recruiter" }, now);
    expect(patch1.notes).toBe("Called recruiter");

    const patch2 = buildTrackerPatch({ notes: null as unknown as string }, now);
    expect(patch2.notes).toBeNull();

    const patch3 = buildTrackerPatch({ notes: 123 as unknown as string }, now);
    expect(patch3.notes).toBeNull();
  });

  it("accepts string applied_at and maps null/empty", () => {
    const patch1 = buildTrackerPatch({ applied_at: "2026-07-01" }, now);
    expect(patch1.applied_at).toBe("2026-07-01");

    const patch2 = buildTrackerPatch({ applied_at: null as unknown as string }, now);
    expect(patch2.applied_at).toBeNull();
  });
});

// ── PATCH /api/tracker/[id] — route handler ────────────────────

const mockServerDb = { from: vi.fn() };

vi.mock("../supabase/server", () => ({
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
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

const mockUser = { id: "user-123", email: "test@example.com" };

describe("tracker/[id] route handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /api/tracker/[id]", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { PATCH } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "PATCH",
        body: JSON.stringify({ status: "applied" }),
      }) as unknown as NextRequest;

      const res = await PATCH(req, { params: { id: "t1" } });
      expect(res.status).toBe(401);
    });

    it("returns 400 for invalid JSON", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const { PATCH } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "PATCH",
        body: "bad-json",
      }) as unknown as NextRequest;

      const res = await PATCH(req, { params: { id: "t1" } });
      expect(res.status).toBe(400);
    });

    it("updates and returns 200 on success", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      const updatedRow = { id: "t1", status: "applied", user_id: "user-123" };
      mockServerDb.from.mockReturnValue(mockQuery(updatedRow));

      const { PATCH } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "PATCH",
        body: JSON.stringify({ status: "applied" }),
      }) as unknown as NextRequest;

      const res = await PATCH(req, { params: { id: "t1" } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.data).toEqual(updatedRow);
    });

    it("returns 404 when entry not found or belongs to another user", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      mockServerDb.from.mockReturnValue(mockQuery(null));

      const { PATCH } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "PATCH",
        body: JSON.stringify({ status: "applied" }),
      }) as unknown as NextRequest;

      const res = await PATCH(req, { params: { id: "t1" } });
      expect(res.status).toBe(404);
    });

    it("returns 500 when Supabase update fails", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      mockServerDb.from.mockReturnValue(mockQuery(null, { message: "db timeout" }));

      const { PATCH } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "PATCH",
        body: JSON.stringify({ status: "applied" }),
      }) as unknown as NextRequest;

      const res = await PATCH(req, { params: { id: "t1" } });
      expect(res.status).toBe(500);
    });
  });

  describe("DELETE /api/tracker/[id]", () => {
    it("returns 401 when unauthenticated", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { DELETE } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "DELETE",
      }) as unknown as NextRequest;

      const res = await DELETE(req, { params: { id: "t1" } });
      expect(res.status).toBe(401);
    });

    it("returns 200 on successful deletion", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      mockServerDb.from.mockReturnValue(mockQuery(null));

      const { DELETE } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "DELETE",
      }) as unknown as NextRequest;

      const res = await DELETE(req, { params: { id: "t1" } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    it("returns 500 when Supabase delete fails", async () => {
      const { getUser } = await import("../supabase/server");
      (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);

      mockServerDb.from.mockReturnValue(mockQuery(null, { message: "db crash" }));

      const { DELETE } = await import("../../app/api/tracker/[id]/route");
      const req = new Request("http://localhost/api/tracker/t1", {
        method: "DELETE",
      }) as unknown as NextRequest;

      const res = await DELETE(req, { params: { id: "t1" } });
      expect(res.status).toBe(500);
    });
  });
});
