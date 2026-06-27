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

function mockDeleteQuery(returnError: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: returnError }),
  };
  return chain;
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

  it("deletes dependent tables before the profile, then the auth user last", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-123" });

    const trackerQuery = mockDeleteQuery();
    const salaryQuery = mockDeleteQuery();
    const cacheQuery = mockDeleteQuery();
    const settingsQuery = mockDeleteQuery();
    const profileQuery = mockDeleteQuery();

    const calls: string[] = [];
    mockAdminDb.from = vi.fn().mockImplementation((table: string) => {
      calls.push(table);
      switch (table) {
        case "tracker_entries":
          return trackerQuery;
        case "salary_reports":
          return salaryQuery;
        case "user_jobs_cache":
          return cacheQuery;
        case "user_settings":
          return settingsQuery;
        case "user_profiles":
          return profileQuery;
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    });

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);

    // Every dependent table was targeted by this user's id
    expect(trackerQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(salaryQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(cacheQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(settingsQuery.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(profileQuery.eq).toHaveBeenCalledWith("id", "user-123");

    // Dependent tables come before the profile row, which comes before
    // the irreversible auth.users deletion.
    expect(calls).toEqual([
      "tracker_entries",
      "salary_reports",
      "user_jobs_cache",
      "user_settings",
      "user_profiles",
    ]);
    expect(mockAdminDb.auth.admin.deleteUser).toHaveBeenCalledWith("user-123");
  });

  it("stops and returns 500 if a dependent-table delete fails, without touching the auth user", async () => {
    const { getUser } = await import("../supabase/server");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-123" });

    const trackerQuery = mockDeleteQuery({ message: "db down" });
    mockAdminDb.from = vi.fn().mockReturnValueOnce(trackerQuery);

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

    mockAdminDb.from = vi.fn().mockImplementation(() => mockDeleteQuery(null));

    const { DELETE } = await import("../../app/api/account/route");
    const res = await DELETE();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });
});
