import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mockServerDb = { from: vi.fn() };

vi.mock("../supabase/server", () => ({
  createServerClient: () => mockServerDb,
  getUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock("../salary-fx", () => ({
  SalaryFxError: class SalaryFxError extends Error {},
  getUsdConversion: vi.fn(),
}));

function mockInsert(data: unknown = { id: "r1" }, error: unknown = null) {
  return {
    data,
    error,
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn().mockReturnThis(),
  };
}

const user = { id: "user-123", email: "user@example.com" };

describe("POST /api/salary conversion provenance", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("../supabase/server");
    const { getUsdConversion } = await import("../salary-fx");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue(user);
    (getUsdConversion as ReturnType<typeof vi.fn>).mockResolvedValue({
      usdAmount: 700,
      usdConversionRate: 0.02,
      usdRateAsOf: "2026-11-08",
      usdRateSource: "test-rate-provider",
    });
  });

  it("stores original amount, conversion provenance, and a server-owned report date", async () => {
    const query = mockInsert();
    mockServerDb.from.mockReturnValue(query);

    const { POST } = await import("../../app/api/salary/route");
    const request = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({
        role_title: "Frontend Engineer",
        years_experience: 4,
        amount: 35_000,
        currency: "EGP",
        reported_at: "2000-01-01T00:00:00.000Z",
      }),
    });

    const response = await POST(request as unknown as NextRequest);
    const inserted = (query.insert as ReturnType<typeof vi.fn>).mock.calls[0][0];

    expect(response.status).toBe(201);
    expect(inserted).toMatchObject({
      source: "user",
      source_record_key: null,
      original_amount: 35_000,
      original_currency: "EGP",
      usd_amount: 700,
      usd_conversion_rate: 0.02,
      usd_rate_as_of: "2026-11-08",
      usd_rate_source: "test-rate-provider",
      salary_egp: 35_000,
      salary_usd: null,
    });
    expect(inserted.reported_at).not.toBe("2000-01-01T00:00:00.000Z");
  });

  it("returns a clear 503 without inserting when conversion is unavailable", async () => {
    const { getUsdConversion, SalaryFxError } = await import("../salary-fx");
    (getUsdConversion as ReturnType<typeof vi.fn>).mockRejectedValue(new SalaryFxError());
    const query = mockInsert();
    mockServerDb.from.mockReturnValue(query);

    const { POST } = await import("../../app/api/salary/route");
    const request = new Request("http://localhost/api/salary", {
      method: "POST",
      body: JSON.stringify({
        role_title: "Frontend Engineer",
        years_experience: 4,
        amount: 35_000,
        currency: "EGP",
      }),
    });
    const response = await POST(request as unknown as NextRequest);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "salary:fx-unavailable",
    });
    expect(query.insert).not.toHaveBeenCalled();
  });
});
