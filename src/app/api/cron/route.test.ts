import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
const mockRunCronJob = vi.fn();
const mockAcquireCronRunLock = vi.fn();
const mockReleaseCronRunLock = vi.fn();
const mockAdminDb = {};

vi.mock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/runner", () => ({ runCronJob: mockRunCronJob }));
vi.mock("@/lib/cron/run-lock", () => ({
  acquireCronRunLock: mockAcquireCronRunLock,
  releaseCronRunLock: mockReleaseCronRunLock,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockAdminDb }));

const successfulRun = {
  total_fetched: 7,
  duration_ms: 1_500,
  errors: ["one fetch failed"],
  warnings: ["one slow source"],
  source_health: { greenhouse: { fetched: 7 } },
  trigger: "manual",
  email_results: [{ sent: true }, { sent: false }],
};

function request(method: "GET" | "POST", authorization?: string) {
  return new Request("http://localhost/api/cron", {
    method,
    headers: authorization ? { authorization } : undefined,
  }) as unknown as NextRequest;
}

describe("/api/cron authorization and overlap protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
    mockRequireAdmin.mockResolvedValue(null);
    mockAcquireCronRunLock.mockResolvedValue({ token: "lock-token" });
    mockReleaseCronRunLock.mockResolvedValue(undefined);
    mockRunCronJob.mockResolvedValue(successfulRun);
  });

  it("runs a secret-authorized POST as the scheduled GitHub Actions trigger", async () => {
    const { POST } = await import("./route");

    const response = await POST(request("POST", "Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(mockRunCronJob).toHaveBeenCalledWith("github_actions");
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockReleaseCronRunLock).toHaveBeenCalledWith(mockAdminDb, { token: "lock-token" });
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: {
        warning_count: 1,
        warnings: ["one slow source"],
        source_health: { greenhouse: { fetched: 7 } },
      },
    });
  });

  it("allows an authenticated admin to make a manual POST without exposing CRON_SECRET", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id" });
    const { POST } = await import("./route");

    const response = await POST(request("POST"));

    expect(response.status).toBe(200);
    expect(mockRunCronJob).toHaveBeenCalledWith("manual");
  });

  it("rejects an unauthenticated POST that does not have the cron secret", async () => {
    const { POST } = await import("./route");

    const response = await POST(request("POST"));

    expect(response.status).toBe(401);
    expect(mockRunCronJob).not.toHaveBeenCalled();
  });

  it("does not let an admin GET trigger a live run", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id" });
    const { GET } = await import("./route");

    const response = await GET(request("GET"));

    expect(response.status).toBe(401);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
    expect(mockRunCronJob).not.toHaveBeenCalled();
  });

  it("returns a conflict without invoking cron when another run owns the lock", async () => {
    mockRequireAdmin.mockResolvedValue({ id: "admin-id" });
    mockAcquireCronRunLock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const response = await POST(request("POST"));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "cron:busy",
    });
    expect(mockRunCronJob).not.toHaveBeenCalled();
  });
});
