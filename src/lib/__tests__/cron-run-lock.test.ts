import { describe, expect, it, vi } from "vitest";
import { acquireCronRunLock, releaseCronRunLock } from "../cron/run-lock";

describe("cron run lock", () => {
  it("returns an invocation-specific token only when the database lock is acquired", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });

    const lock = await acquireCronRunLock({ rpc } as never);

    expect(lock).toEqual({ token: expect.any(String) });
    expect(rpc).toHaveBeenCalledWith(
      "jr_acquire_cron_run_lock",
      expect.objectContaining({ p_stale_after_seconds: 600, p_token: lock?.token }),
    );
  });

  it("reports an unavailable lock without treating it as a database failure", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });

    await expect(acquireCronRunLock({ rpc } as never)).resolves.toBeNull();
  });

  it("throws an actionable error when acquiring or releasing the database lock fails", async () => {
    const acquireRpc = vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } });
    await expect(acquireCronRunLock({ rpc: acquireRpc } as never)).rejects.toThrow(
      "Failed to acquire cron run lock: permission denied",
    );

    const releaseRpc = vi.fn().mockResolvedValue({ error: { message: "connection lost" } });
    await expect(
      releaseCronRunLock({ rpc: releaseRpc } as never, { token: "lock-token" }),
    ).rejects.toThrow("Failed to release cron run lock: connection lost");
  });
});
