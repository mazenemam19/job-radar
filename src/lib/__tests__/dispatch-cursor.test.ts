// src/lib/__tests__/dispatch-cursor.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = {
  from: vi.fn(),
};

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockDb,
}));

import type { ATSCompanyRow } from "../types";

function makeCompanyRow(overrides: Partial<ATSCompanyRow> = {}): ATSCompanyRow {
  return {
    id: "comp-1",
    name: "Test Corp",
    ats: "greenhouse",
    slug: "testcorp",
    country: "GB",
    country_flag: "🇬🇧",
    city: "London",
    pipeline_local: true,
    pipeline_global: false,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRows(ids: string[]): ATSCompanyRow[] {
  return ids.map((id, i) =>
    makeCompanyRow({ id, created_at: `2025-01-${String(i + 1).padStart(2, "0")}T00:00:00Z` }),
  );
}

function mockSelect(
  data: { dispatch_cursor: unknown } | null,
  error: { message: string } | null = null,
) {
  mockDb.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  });
}

function mockUpdate(error: { message: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const update = vi.fn().mockReturnValue({ eq });
  mockDb.from.mockReturnValue({ update });
  return { update, eq };
}

describe("sortAndRotate", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sorts by created_at ascending when there is no persisted cursor", async () => {
    const { sortAndRotate } = await import("../cron/dispatch-cursor");
    const rows = [makeRows(["a"])[0], makeRows(["b"])[0], makeRows(["c"])[0]].reverse();
    const result = sortAndRotate(rows);
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks ties on id when created_at is identical (FR1 bulk-import case)", async () => {
    const { sortAndRotate } = await import("../cron/dispatch-cursor");
    const rows = [
      makeCompanyRow({ id: "z", created_at: "2025-06-01T00:00:00Z" }),
      makeCompanyRow({ id: "a", created_at: "2025-06-01T00:00:00Z" }),
    ];
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["a", "z"]);
  });

  it("rotates to resume right after the persisted cursor (FR3)", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const rows = makeRows(["a", "b", "c", "d", "e"]);
    recordDispatchCursor(rows, new Set(["b"]));
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["c", "d", "e", "a", "b"]);
  });

  it("wraps to the start when the cursor was the last company in sort order (FR5)", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const rows = makeRows(["a", "b", "c"]);
    recordDispatchCursor(rows, new Set(["c"]));
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("resumes from the next active company by sort key when the cursor company is gone (FR4)", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const allRows = makeRows(["a", "b", "c", "d"]);
    recordDispatchCursor(allRows, new Set(["b"])); // cursor = b

    // Next run: "b" has since been deactivated or deleted — it's simply
    // absent from the active rows, with no lookup needed to place it.
    const stillActive = allRows.filter((r) => r.id !== "b");
    expect(sortAndRotate(stillActive).map((r) => r.id)).toEqual(["c", "d", "a"]);
  });

  it("wraps to the start when the (now-gone) cursor company was at the tail (FR4 + FR5 combined)", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const allRows = makeRows(["a", "b", "c"]);
    recordDispatchCursor(allRows, new Set(["c"])); // cursor = c, the tail

    const stillActive = allRows.filter((r) => r.id !== "c");
    expect(sortAndRotate(stillActive).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("recordDispatchCursor", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("is a no-op when the bucket is empty", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    recordDispatchCursor([], new Set());
    const rows = makeRows(["a", "b"]);
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["a", "b"]); // unchanged — no cursor set
  });

  it("is a no-op when nothing was dispatched this run", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const rows = makeRows(["a", "b"]);
    recordDispatchCursor(rows, new Set()); // everything skipped before any dispatch
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("finds the last dispatched company in the given order, ignoring a skipped tail", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const [a, b, c, d, e] = makeRows(["a", "b", "c", "d", "e"]);
    const rotatedThisRun = [c, d, e, a, b]; // e.g. a prior rotation already in effect
    recordDispatchCursor(rotatedThisRun, new Set(["c", "d", "e", "a"])); // only "b" skipped

    // "a" was the last one actually dispatched (in THIS run's order) — so
    // the very next company after it, "b", should lead next run.
    const canonical = [a, b, c, d, e];
    expect(sortAndRotate(canonical).map((r) => r.id)).toEqual(["b", "c", "d", "e", "a"]);
  });

  // Directly proves the Success Criteria claim: across N consecutive
  // time-budget-limited runs, every company gets dispatched at least once
  // per bucket-sized rotation cycle — not the same tail every time.
  it("cycles every company through the skipped position exactly once per full rotation", async () => {
    const { sortAndRotate, recordDispatchCursor } = await import("../cron/dispatch-cursor");
    const ids = ["a", "b", "c", "d", "e"];
    const canonical = makeRows(ids);

    const skippedEachRun: string[] = [];
    let dispatchOrder = sortAndRotate(canonical);

    for (let run = 0; run < 5; run++) {
      // Adversarial worst case: only the first 4 of this run's dispatch
      // order fit the time budget; the tail always gets skipped.
      const dispatched = new Set(dispatchOrder.slice(0, 4).map((r) => r.id));
      skippedEachRun.push(dispatchOrder[4].id);

      recordDispatchCursor(dispatchOrder, dispatched);
      dispatchOrder = sortAndRotate(canonical);
    }

    expect(new Set(skippedEachRun).size).toBe(5); // every company skipped exactly once
    expect(skippedEachRun.slice().sort()).toEqual(ids.slice().sort());
  });
});

describe("loadDispatchCursorFromDB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("loads a previously persisted cursor and applies it on the next rotation", async () => {
    mockSelect({ dispatch_cursor: { companyId: "b", createdAt: "2025-01-02T00:00:00Z" } });
    const { loadDispatchCursorFromDB, sortAndRotate } = await import("../cron/dispatch-cursor");
    await loadDispatchCursorFromDB();

    const rows = makeRows(["a", "b", "c"]);
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("treats a null persisted cursor (first-ever run) as no rotation", async () => {
    mockSelect({ dispatch_cursor: null });
    const { loadDispatchCursorFromDB, sortAndRotate } = await import("../cron/dispatch-cursor");
    await loadDispatchCursorFromDB();

    const rows = makeRows(["a", "b"]);
    expect(sortAndRotate(rows).map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("logs and returns early when the app_config select fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockSelect(null, { message: "connection reset" });

    const { loadDispatchCursorFromDB } = await import("../cron/dispatch-cursor");
    await loadDispatchCursorFromDB();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[dispatch-cursor] loadDispatchCursorFromDB select failed:",
      "connection reset",
    );
    consoleErrorSpy.mockRestore();
  });
});

describe("flushDispatchCursorToDB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("skips the write when nothing was recorded this run", async () => {
    const { flushDispatchCursorToDB } = await import("../cron/dispatch-cursor");
    const result = await flushDispatchCursorToDB();
    expect(result).toBeNull();
    expect(mockDb.from).not.toHaveBeenCalled();
  });

  it("persists the recorded cursor via an app_config update", async () => {
    const { update } = mockUpdate(null);
    const { recordDispatchCursor, flushDispatchCursorToDB } =
      await import("../cron/dispatch-cursor");

    const rows = makeRows(["a"]);
    recordDispatchCursor(rows, new Set(["a"]));
    const result = await flushDispatchCursorToDB();

    expect(result).toBeNull();
    expect(mockDb.from).toHaveBeenCalledWith("app_config");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        dispatch_cursor: { companyId: "a", createdAt: rows[0].created_at },
      }),
    );
  });

  it("keeps the pending cursor on update error so a retry can still send it", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockDb.from
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: { message: "conn reset" } }),
        }),
      })
      .mockReturnValueOnce({
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      });

    const { recordDispatchCursor, flushDispatchCursorToDB } =
      await import("../cron/dispatch-cursor");
    const rows = makeRows(["a"]);
    recordDispatchCursor(rows, new Set(["a"]));

    const firstResult = await flushDispatchCursorToDB(); // fails — must not clear the pending cursor
    const secondResult = await flushDispatchCursorToDB(); // retry — should still attempt the write

    expect(firstResult).toBe("Failed to persist dispatch cursor: conn reset");
    expect(secondResult).toBeNull();
    expect(mockDb.from).toHaveBeenCalledTimes(2);
    consoleErrorSpy.mockRestore();
  });

  it("does not retry once a flush has already succeeded", async () => {
    const { update } = mockUpdate(null);
    const { recordDispatchCursor, flushDispatchCursorToDB } =
      await import("../cron/dispatch-cursor");

    const rows = makeRows(["a"]);
    recordDispatchCursor(rows, new Set(["a"]));
    await flushDispatchCursorToDB();
    const secondResult = await flushDispatchCursorToDB(); // nothing new recorded since — must not re-send

    expect(secondResult).toBeNull();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
