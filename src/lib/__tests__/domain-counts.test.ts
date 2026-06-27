// src/lib/__tests__/domain-counts.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the admin client before importing ats-utils
const mockDb = {
  from: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockDb,
}));

describe("domain_counts persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("loads domain_counts from app_config on startup", async () => {
    const testCounts = { "example.com": 5, "test.io": 3 };

    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              workable_blocked: null,
              workable_budget: null,
              domain_counts: testCounts,
            },
            error: null,
          }),
        }),
      }),
    });

    const { loadWorkableStateFromDB } = await import("../sources/ats-utils");
    await loadWorkableStateFromDB();

    // Verify the SELECT was made with domain_counts
    expect(mockDb.from).toHaveBeenCalledWith("app_config");
    const selectFn = mockDb.from.mock.results[0].value.select;
    expect(selectFn).toHaveBeenCalledWith("workable_blocked, workable_budget, domain_counts");
  });

  it("returns empty object when domain_counts is null in DB", async () => {
    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { workable_blocked: null, workable_budget: null, domain_counts: null },
            error: null,
          }),
        }),
      }),
    });

    const { loadWorkableStateFromDB } = await import("../sources/ats-utils");
    await loadWorkableStateFromDB();

    // Load succeeded without error
    expect(mockDb.from).toHaveBeenCalledTimes(1);
  });

  it("skips flush when domain_counts cache is empty", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { workable_blocked: null, workable_budget: null, domain_counts: null },
            error: null,
          }),
        }),
      }),
      update: updateMock,
    });

    const { loadWorkableStateFromDB, flushDomainCountsToDB } = await import("../sources/ats-utils");
    await loadWorkableStateFromDB();

    // Flush with empty cache should be a no-op (no update call)
    await flushDomainCountsToDB();

    // update should NOT have been called (cache was null/empty)
    expect(updateMock).not.toHaveBeenCalled();
  });
});
