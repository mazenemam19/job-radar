import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAdminDb = { from: vi.fn() };

vi.mock("../supabase/admin", () => ({
  createAdminClient: () => mockAdminDb,
}));

function mockQuery(data: unknown, error: unknown = null) {
  return {
    data,
    error,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  };
}

describe("GET /api/companies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns featured companies without requiring authentication or exposing ATS metadata", async () => {
    const query = mockQuery([
      {
        id: "company-1",
        name: "Example GmbH",
        country: "Germany",
        country_flag: "🇩🇪",
        city: "Berlin",
        ats: "greenhouse",
        slug: "private-board-slug",
        pipeline_global: true,
      },
    ]);
    mockAdminDb.from.mockReturnValue(query);

    const { GET } = await import("../../app/api/companies/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockAdminDb.from).toHaveBeenCalledWith("ats_companies");
    expect(query.select).toHaveBeenCalledWith("id, name, country, country_flag, city");
    expect(query.eq).toHaveBeenCalledWith("is_featured", true);
    expect(query.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(body).toEqual({
      ok: true,
      data: [
        {
          id: "company-1",
          name: "Example GmbH",
          country: "Germany",
          country_flag: "🇩🇪",
          city: "Berlin",
        },
      ],
    });
  });

  it("returns a generic 500 response if the public query fails", async () => {
    mockAdminDb.from.mockReturnValue(mockQuery(null, { message: "connection reset" }));

    const { GET } = await import("../../app/api/companies/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({ ok: false, code: "companies:GET" });
  });
});
