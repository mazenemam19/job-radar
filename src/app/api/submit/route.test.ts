// src/app/api/submit/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const mockAdminDb = { from: vi.fn() };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

function mockQuery(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {
    data,
    error,
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

let ipCounter = 0;
function makeSubmitRequest(body: Record<string, unknown>, headers?: Record<string, string>) {
  // Each call gets a unique IP to avoid module-level rate limit pollution between tests
  const defaultIp = `10.0.${Math.floor(ipCounter / 256)}.${ipCounter % 256}`;
  ipCounter++;
  return new Request("http://localhost/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": defaultIp, ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-29T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/submit", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req as unknown as NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when company_name is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeSubmitRequest({
      ats_type: "greenhouse",
      slug: "test-co",
      country: "Egypt",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("company_name");
  });

  it("returns 400 when ats_type is invalid", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeSubmitRequest({
      company_name: "Test Co",
      ats_type: "not-a-real-ats",
      slug: "test-co",
      country: "Egypt",
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("ats_type");
  });

  it("returns 400 when slug is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeSubmitRequest({
      company_name: "Test Co",
      ats_type: "greenhouse",
      country: "Egypt",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when country is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeSubmitRequest({
      company_name: "Test Co",
      ats_type: "greenhouse",
      slug: "test-co",
    }));
    expect(res.status).toBe(400);
  });

  it("returns 201 and inserts submission on success", async () => {
    const chain: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "sub-1", status: "pending" }, error: null }),
    };
    mockAdminDb.from.mockReturnValue(chain);

    const { POST } = await import("./route");
    const res = await POST(makeSubmitRequest({
      company_name: "Test Co",
      ats_type: "greenhouse",
      slug: "test-co",
      country: "Egypt",
    }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe("sub-1");
  });

  it("returns 500 when db insert fails", async () => {
    mockAdminDb.from.mockReturnValue(mockQuery(null, { message: "duplicate key" }));

    const { POST } = await import("./route");
    const res = await POST(makeSubmitRequest({
      company_name: "Test Co",
      ats_type: "greenhouse",
      slug: "test-co",
      country: "Egypt",
    }));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("Something went wrong. Please try again.");
  });

  it("returns 429 when rate limit exceeded (>5 submissions per 10min from same IP)", async () => {
    mockAdminDb.from.mockReturnValue(mockQuery({ id: "sub-x", status: "pending" }));

    const { POST } = await import("./route");

    // Submit 5 times successfully
    for (let i = 0; i < 5; i++) {
      const res = await POST(makeSubmitRequest({
        company_name: `Co ${i}`,
        ats_type: "greenhouse",
        slug: `co-${i}`,
        country: "Egypt",
      }, { "x-forwarded-for": "1.2.3.4" }));
      expect(res.status).toBe(201);
    }

    // 6th should be rate limited
    const limited = await POST(makeSubmitRequest({
      company_name: "Rate Limited Co",
      ats_type: "greenhouse",
      slug: "rate-limited",
      country: "Egypt",
    }, { "x-forwarded-for": "1.2.3.4" }));

    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toContain("Too many");
  });
});
