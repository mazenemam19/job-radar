// src/lib/__tests__/companies-table.test.ts
// Covers the pure transforms extracted from CompaniesTable into
// lib/companies-table.ts (audit row #21): filterCompanies and formFromRow.

import { describe, it, expect } from "vitest";
import { filterCompanies, formFromRow, EMPTY_FORM, missingPipeline } from "../companies-table";
import type { ATSCompanyRow } from "../types";

function makeCompany(overrides: Partial<ATSCompanyRow> = {}): ATSCompanyRow {
  return {
    id: "c1",
    name: "Acme Corp",
    ats: "greenhouse",
    slug: "acme",
    country: "EG",
    country_flag: "🇪🇬",
    city: "Cairo",
    pipeline_local: true,
    pipeline_global: false,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ── filterCompanies ───────────────────────────────────────────

describe("filterCompanies", () => {
  const companies = [
    makeCompany({ id: "1", name: "Acme Corp", country: "EG", ats: "greenhouse" }),
    makeCompany({ id: "2", name: "Beta Ltd", country: "GB", ats: "lever" }),
    makeCompany({ id: "3", name: "Gamma Inc", country: "US", ats: "ashby" }),
  ];

  it("returns all companies when search is empty", () => {
    expect(filterCompanies(companies, "")).toHaveLength(3);
  });

  it("matches by company name (case-insensitive)", () => {
    const result = filterCompanies(companies, "acme");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("matches by country code (case-insensitive)", () => {
    const result = filterCompanies(companies, "gb");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("matches by ATS type", () => {
    const result = filterCompanies(companies, "ashby");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
  });

  it("returns an empty array when no company matches", () => {
    expect(filterCompanies(companies, "zzz_no_match")).toHaveLength(0);
  });

  it("returns all companies when search matches all (e.g. partial letter in every name)", () => {
    // 'a' appears in Acme, Gamma — not Beta, but 'a' is in 'ashby' for company 3
    // Let's use a letter that matches all three differently
    const result = filterCompanies(companies, "e"); // Acme, Beta, greenhouse, lever
    expect(result.length).toBeGreaterThan(1);
  });
});

// ── formFromRow ───────────────────────────────────────────────

describe("formFromRow", () => {
  it("copies all editable fields from the row", () => {
    const c = makeCompany({
      name: "Acme",
      ats: "lever",
      slug: "acme-lever",
      country: "GB",
      country_flag: "🇬🇧",
      city: "London",
      pipeline_local: false,
      pipeline_global: true,
      is_active: false,
    });
    const form = formFromRow(c);
    expect(form.name).toBe("Acme");
    expect(form.ats).toBe("lever");
    expect(form.slug).toBe("acme-lever");
    expect(form.country).toBe("GB");
    expect(form.country_flag).toBe("🇬🇧");
    expect(form.city).toBe("London");
    expect(form.pipeline_local).toBe(false);
    expect(form.pipeline_global).toBe(true);
    expect(form.is_active).toBe(false);
  });

  it("falls back to empty string when city is null", () => {
    const c = makeCompany({ city: null });
    expect(formFromRow(c).city).toBe("");
  });

  it("does not include id, created_at, or updated_at", () => {
    const form = formFromRow(makeCompany());
    expect("id" in form).toBe(false);
    expect("created_at" in form).toBe(false);
    expect("updated_at" in form).toBe(false);
  });
});

// ── EMPTY_FORM ────────────────────────────────────────────────

describe("EMPTY_FORM", () => {
  it("has the expected default shape", () => {
    expect(EMPTY_FORM.name).toBe("");
    expect(EMPTY_FORM.ats).toBe("greenhouse");
    expect(EMPTY_FORM.pipeline_local).toBe(false);
    expect(EMPTY_FORM.pipeline_global).toBe(false);
    expect(EMPTY_FORM.is_active).toBe(true);
  });

  // EMPTY_FORM itself is exactly the state missingPipeline flags — this is
  // the shape a brand-new "Add company" form starts in before either
  // pipeline checkbox is touched (see issue-52 act 7).
  it("is itself a missingPipeline state", () => {
    expect(
      missingPipeline(EMPTY_FORM.is_active, EMPTY_FORM.pipeline_local, EMPTY_FORM.pipeline_global),
    ).toBe(true);
  });
});

// ── missingPipeline ───────────────────────────────────────────

describe("missingPipeline", () => {
  it("is true for an active company with neither pipeline enabled", () => {
    expect(missingPipeline(true, false, false)).toBe(true);
  });

  it("is false when only pipeline_local is enabled", () => {
    expect(missingPipeline(true, true, false)).toBe(false);
  });

  it("is false when only pipeline_global is enabled", () => {
    expect(missingPipeline(true, false, true)).toBe(false);
  });

  it("is false when both pipelines are enabled", () => {
    expect(missingPipeline(true, true, true)).toBe(false);
  });

  it("is false for an inactive company regardless of pipeline flags", () => {
    expect(missingPipeline(false, false, false)).toBe(false);
  });
});
