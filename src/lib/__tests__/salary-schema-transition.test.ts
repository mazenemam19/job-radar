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

function mockQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {
    data,
    error,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

describe("salary schema transition", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { getUser } = await import("../supabase/server");
    const { getUsdConversion } = await import("../salary-fx");
    (getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "user-123" });
    (getUsdConversion as ReturnType<typeof vi.fn>).mockResolvedValue({
      usdAmount: 700,
      usdConversionRate: 0.02,
      usdRateAsOf: "2026-11-08",
      usdRateSource: "test-rate-provider",
    });
  });

  it("keeps GET available with legacy USD rows while excluding unconverted legacy currencies", async () => {
    const provenanceError = {
      message: "column salary_reports.years_experience_exact does not exist",
    };
    const legacyRows = [
      {
        role_title: "Legacy USD Role",
        years_experience: 4,
        currency: "USD",
        salary_egp: null,
        salary_usd: 700,
        pipeline: "global",
        reported_at: "2024-06-01T00:00:00Z",
      },
      {
        role_title: "Legacy USD Role",
        years_experience: 4,
        currency: "USD",
        salary_egp: null,
        salary_usd: 800,
        pipeline: "global",
        reported_at: "2024-06-15T00:00:00Z",
      },
      {
        role_title: "Legacy EGP Role",
        years_experience: 4,
        currency: "EGP",
        salary_egp: 30_000,
        salary_usd: null,
        pipeline: "global",
        reported_at: "2024-06-15T00:00:00Z",
      },
    ];
    mockServerDb.from
      .mockReturnValueOnce(mockQuery(null, provenanceError))
      .mockReturnValueOnce(mockQuery(legacyRows));

    const { GET } = await import("../../app/api/salary/route");
    const response = await GET(
      new Request("http://localhost/api/salary") as unknown as NextRequest,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject([{ role_title: "Legacy USD Role", currency: "USD" }]);
    expect(body.meta).toEqual({ skipped_unconverted_count: 1 });
  });

  it("returns a clear 503 rather than writing without provenance columns", async () => {
    mockServerDb.from.mockReturnValue(
      mockQuery(null, { message: "column salary_reports.original_amount does not exist" }),
    );

    const { POST } = await import("../../app/api/salary/route");
    const response = await POST(
      new Request("http://localhost/api/salary", {
        method: "POST",
        body: JSON.stringify({
          role_title: "Frontend Engineer",
          years_experience: 4,
          amount: 35_000,
          currency: "EGP",
        }),
      }) as unknown as NextRequest,
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, code: "salary:schema-upgrade-required" });
  });
});
