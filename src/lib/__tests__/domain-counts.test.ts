// src/lib/__tests__/domain-counts.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the admin client before importing ats-utils
const mockDb = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockDb,
}));

function mockSelect(data: { workable_blocked: unknown; workable_budget: unknown }) {
  mockDb.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error: null }),
      }),
    }),
  });
}

describe("domain_counts persistence (atomic increment)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no longer selects or loads domain_counts on startup", async () => {
    mockSelect({ workable_blocked: null, workable_budget: null });

    const { loadWorkableStateFromDB } = await import("../sources/ats-utils");
    await loadWorkableStateFromDB();

    // Regression guard for the double-count bug: domain_counts must never be
    // read into the in-memory delta cache, since flushDomainCountsToDB() now
    // ADDS that cache onto the DB's existing value via an atomic RPC. If this
    // were ever re-seeded from the DB, every flush would add the old total
    // back on top of itself.
    expect(mockDb.from).toHaveBeenCalledWith("app_config");
    const selectFn = mockDb.from.mock.results[0].value.select;
    expect(selectFn).toHaveBeenCalledWith("workable_blocked, workable_budget");
  });

  it("skips flush when nothing was tracked this run", async () => {
    const { flushDomainCountsToDB } = await import("../sources/ats-utils");

    await flushDomainCountsToDB();

    expect(mockDb.rpc).not.toHaveBeenCalled();
  });

  it("sends only this run's delta to increment_domain_counts, never a pre-loaded baseline", async () => {
    mockSelect({ workable_blocked: null, workable_budget: null });
    mockDb.rpc.mockResolvedValue({ data: null, error: null });

    const { loadWorkableStateFromDB, flushDomainCountsToDB, safeFetch } =
      await import("../sources/ats-utils");

    await loadWorkableStateFromDB();

    await safeFetch("https://boards.greenhouse.io/foo");
    await safeFetch("https://boards.greenhouse.io/bar");
    await safeFetch("https://jobs.lever.co/baz");

    await flushDomainCountsToDB();

    expect(mockDb.rpc).toHaveBeenCalledWith("increment_domain_counts", {
      increments: { "boards.greenhouse.io": 2, "jobs.lever.co": 1 },
    });
  });

  it("resets the in-memory delta after a successful flush so a warm process doesn't resend it", async () => {
    mockDb.rpc.mockResolvedValue({ data: null, error: null });
    const { flushDomainCountsToDB, safeFetch } = await import("../sources/ats-utils");

    await safeFetch("https://boards.greenhouse.io/foo");
    await flushDomainCountsToDB();
    await flushDomainCountsToDB(); // same warm process, nothing new tracked since

    expect(mockDb.rpc).toHaveBeenCalledTimes(1);
  });

  it("keeps the unflushed delta on rpc error so a later flush can still send it", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "connection reset" } })
      .mockResolvedValueOnce({ data: null, error: null });

    const { flushDomainCountsToDB, safeFetch } = await import("../sources/ats-utils");

    await safeFetch("https://boards.greenhouse.io/foo");
    await flushDomainCountsToDB(); // fails — must not clear the cache
    await flushDomainCountsToDB(); // retry — should still include the same delta

    expect(mockDb.rpc).toHaveBeenCalledTimes(2);
    expect(mockDb.rpc).toHaveBeenNthCalledWith(2, "increment_domain_counts", {
      increments: { "boards.greenhouse.io": 1 },
    });

    consoleErrorSpy.mockRestore();
  });

  it("logs and returns early when the app_config select fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockDb.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'relation "app_config" does not exist' },
          }),
        }),
      }),
    });

    const { loadWorkableStateFromDB } = await import("../sources/ats-utils");
    await loadWorkableStateFromDB();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[ats-utils] loadWorkableStateFromDB select failed:",
      'relation "app_config" does not exist',
    );

    consoleErrorSpy.mockRestore();
  });
});
