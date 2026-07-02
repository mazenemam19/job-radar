// src/lib/__tests__/approve-submission.test.ts
import { describe, it, expect, vi } from "vitest";
import { approveSubmission } from "../admin/approve-submission";

// Minimal fake Supabase client: each call to `from` returns a fresh
// thenable chain so select/insert can be asserted independently.
function fakeDb(selectResult: { data: unknown; error: unknown }) {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
  };
  const from = vi.fn((table: string) => (table === "ats_submissions" ? selectChain : { insert }));
  return {
    db: { from } as unknown as Parameters<typeof approveSubmission>[0],
    insert,
    selectChain,
  };
}

describe("approveSubmission", () => {
  it("returns not-found when the submission doesn't exist", async () => {
    const { db } = fakeDb({ data: null, error: null });
    const result = await approveSubmission(db, "sub-1", {}, "2026-07-02T00:00:00.000Z");
    expect(result).toEqual({ ok: false, error: "Submission not found" });
  });

  it("returns not-found when the select errors", async () => {
    const { db } = fakeDb({ data: null, error: { message: "boom" } });
    const result = await approveSubmission(db, "sub-1", {}, "now");
    expect(result.ok).toBe(false);
  });

  it("inserts a company using submission values by default", async () => {
    const sub = {
      company_name: "Acme",
      ats_type: "greenhouse",
      slug: "acme",
      country: "US",
      country_flag: "🇺🇸",
      city: "NYC",
      pipeline_local: true,
      pipeline_global: false,
    };
    const { db, insert } = fakeDb({ data: sub, error: null });
    const result = await approveSubmission(db, "sub-1", {}, "2026-07-02T00:00:00.000Z");

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Acme",
        ats: "greenhouse",
        slug: "acme",
        is_active: true,
        created_at: "2026-07-02T00:00:00.000Z",
      }),
    );
  });

  it("prefers body overrides over submission values", async () => {
    const sub = {
      company_name: "Acme",
      ats_type: "greenhouse",
      slug: "acme",
      country: "US",
      country_flag: "🇺🇸",
      city: "NYC",
      pipeline_local: true,
      pipeline_global: false,
    };
    const { db, insert } = fakeDb({ data: sub, error: null });
    await approveSubmission(
      db,
      "sub-1",
      { name: "Acme Corp", ats_type: "lever", slug: "acme-corp" },
      "now",
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme Corp", ats: "lever", slug: "acme-corp" }),
    );
  });
});
