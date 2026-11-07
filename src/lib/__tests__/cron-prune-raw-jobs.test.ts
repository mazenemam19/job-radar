import { describe, expect, it, vi } from "vitest";
import {
  RAW_JOB_RETENTION_DAYS,
  pruneStaleUntrackedRawJobs,
  rawJobRetentionCutoff,
} from "../cron/prune-raw-jobs";

describe("rawJobRetentionCutoff", () => {
  it("uses the documented 90-day UTC retention window", () => {
    expect(RAW_JOB_RETENTION_DAYS).toBe(90);
    expect(rawJobRetentionCutoff(new Date("2026-11-07T12:00:00.000Z"))).toBe(
      "2026-08-09T12:00:00.000Z",
    );
  });
});

describe("pruneStaleUntrackedRawJobs", () => {
  it("delegates the atomic, tracked-job-safe delete to the database", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 8154, error: null });

    const result = await pruneStaleUntrackedRawJobs(
      { rpc } as never,
      new Date("2026-11-07T12:00:00.000Z"),
    );

    expect(rpc).toHaveBeenCalledWith("jr_prune_stale_untracked_raw_jobs", {
      p_cutoff: "2026-08-09T12:00:00.000Z",
    });
    expect(result).toEqual({
      ok: true,
      deletedCount: 8154,
      cutoff: "2026-08-09T12:00:00.000Z",
    });
  });

  it("returns the database error without pretending that cleanup succeeded", async () => {
    const result = await pruneStaleUntrackedRawJobs(
      {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } }),
      } as never,
      new Date("2026-11-07T12:00:00.000Z"),
    );

    expect(result).toEqual({
      ok: false,
      error: "permission denied",
      cutoff: "2026-08-09T12:00:00.000Z",
    });
  });
});
