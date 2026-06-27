// src/lib/__tests__/account-delete.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Supabase clients ──────────────────────────────────────

const mockAdminDb = {
  from: vi.fn(),
  auth: { admin: { deleteUser: vi.fn() } },
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

vi.mock("../supabase/server", () => ({
  createServerClient: () => ({ from: vi.fn() }),
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

// select("role").eq("id", ...).single() — the caller-profile lookup
function mockRoleQuery(role: string | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: role ? { role } : null, error }),
  };
}

// select("id", { count, head }).eq("role", "admin") — the admin headcount
function mockCountQuery(count: number, error: unknown = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ count, error }),
  };
}

// delete().eq(...) — every per-table cleanup step
function mockDeleteQuery(error: unknown = null) {
  return {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error }),
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe("DELETE /api/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminDb.auth.admin.deleteUser.mockResolvedValue({ error: null });
  });

  it("returns 401 when unauthenticated", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("deletes dependent tables before the profile, then the auth user last (non-admin)", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-123" });

    const roleQuery = mockRoleQuery("user");
    const trackerQuery = mockDeleteQuery();
    const salaryQuery = mockDeleteQuery();
    const cacheQuery = mockDeleteQuery();
    const settingsQuery = mockDeleteQuery();
    const profileDeleteQuery = mockDeleteQuery();

    const calls: string[] = [];
    mockAdminDb.from = vi
      .fn()
      .mockImplementationOnce((table: string) => {
        calls.push(table); // user_profiles (role check)
        return roleQuery;
      })
      .mockImplementationOnce((table: string) => {
        calls.push(table); // tracker_entries
        return trackerQuery;
      })
      .mockImplementationOnce((table: string) => {
        calls.push(table); // salary_reports
        return salaryQuery;
      })
      .mockImplementationOnce((table: string) => {
        calls.push(table); // user_jobs_cache
        return cacheQuery;
      })
      .mockImplementationOnce((table: string) => {
        calls.push(table); // user_settings
        return settingsQuery;
      })
      .mockImplementationOnce((table: string) => {
        calls.push(table); // user_profiles (delete)
        return profileDeleteQuery;
      });

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    expect(trackerQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(salaryQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(cacheQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(settingsQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(profileDeleteQuery.eq).toHaveBeenCalledWith("id", "user-123");

    // Role check first, then dependent tables, then the profile row, before
    // the irreversible auth.users deletion.
    expect(calls).toEqual([
      "user_profiles",
      "tracker_entries",
      "salary_reports",
      "user_jobs_cache",
      "user_settings",
      "user_profiles",
    ]);
    expect(mockAdminDb.auth.admin.deleteUser).toHaveBeenCalledWith("user-123");
  });

  it("blocks deletion when the caller is the only admin", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-1" });

    const roleQuery = mockRoleQuery("admin");
    const countQuery = mockCountQuery(1); // only one admin left — the caller

    mockAdminDb.from = vi.fn().mockReturnValueOnce(roleQuery).mockReturnValueOnce(countQuery);

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/only admin/i);
    expect(mockAdminDb.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("allows an admin to delete their account when other admins exist", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "admin-1" });

    const roleQuery = mockRoleQuery("admin");
    const countQuery = mockCountQuery(2); // another admin exists

    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(roleQuery)
      .mockReturnValueOnce(countQuery)
      .mockImplementation(() => mockDeleteQuery(null));

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockAdminDb.auth.admin.deleteUser).toHaveBeenCalledWith("admin-1");
  });

  it("stops and returns 500 if a dependent-table delete fails, without touching the auth user", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-123" });

    const roleQuery = mockRoleQuery("user");
    const trackerQuery = mockDeleteQuery({ message: "db down" });

    mockAdminDb.from = vi.fn().mockReturnValueOnce(roleQuery).mockReturnValueOnce(trackerQuery);

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();

    expect(res.status).toBe(500);
    expect(mockAdminDb.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("succeeds when optional tables (salary, tracker) have zero rows for the user", async () => {
    // delete().eq() on a table with no matching rows is not an error in
    // Supabase — it just affects zero rows. Confirm the route treats that
    // as success, since most users never submit a salary report.
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-456" });

    const roleQuery = mockRoleQuery("user");
    mockAdminDb.from = vi
      .fn()
      .mockReturnValueOnce(roleQuery)
      .mockImplementation(() => mockDeleteQuery(null));

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
