// src/lib/__tests__/build-company-patch.test.ts
import { describe, it, expect } from "vitest";
import { buildCompanyPatch } from "../admin/build-company-patch";

describe("buildCompanyPatch", () => {
  it("accepts string fields only when typeof string", () => {
    const result = buildCompanyPatch({ name: "Acme", slug: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.name).toBe("Acme");
      expect(result.patch.slug).toBeUndefined();
    }
  });

  it("accepts boolean fields only when typeof boolean", () => {
    const result = buildCompanyPatch({ pipeline_local: true, is_active: "yes" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.pipeline_local).toBe(true);
      expect(result.patch.is_active).toBeUndefined();
    }
  });

  it("accepts a valid ats value", () => {
    const result = buildCompanyPatch({ ats: "greenhouse" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.ats).toBe("greenhouse");
    }
  });

  it("rejects an invalid ats value", () => {
    const result = buildCompanyPatch({ ats: "not_a_real_ats" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid ATS type");
    }
  });

  it("skips ats validation for a falsy value but still assigns it as a string", () => {
    const result = buildCompanyPatch({ ats: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.ats).toBe("");
    }
  });

  it("sets city to a string value", () => {
    const result = buildCompanyPatch({ city: "Cairo" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.city).toBe("Cairo");
    }
  });

  it("sets city to null when explicitly nulled", () => {
    const result = buildCompanyPatch({ city: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.city).toBeNull();
    }
  });

  it("sets city to undefined for a non-string, non-null value", () => {
    const result = buildCompanyPatch({ city: 123 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.city).toBeUndefined();
    }
  });

  it("leaves city untouched when not present in body", () => {
    const result = buildCompanyPatch({ name: "Acme" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect("city" in result.patch).toBe(false);
    }
  });

  it("ignores unknown keys entirely", () => {
    const result = buildCompanyPatch({ made_up_field: "whatever" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.patch as Record<string, unknown>).made_up_field).toBeUndefined();
    }
  });

  it("always sets updated_at", () => {
    const result = buildCompanyPatch({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.patch.updated_at).toBe("string");
    }
  });
});
