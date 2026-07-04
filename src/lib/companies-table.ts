// src/lib/companies-table.ts
// Pure logic backing CompaniesTable — no React, no fetch.
// State and fetch operations live in hooks/useCompaniesTable.ts;
// this file holds the types, constants, and transforms so they can be
// unit tested without mounting a component.

import type { ATSCompanyRow } from "@/lib/types";

// ── Types & constants ─────────────────────────────────────────

export type CompanyForm = Omit<ATSCompanyRow, "id" | "created_at" | "updated_at">;

export const EMPTY_FORM: CompanyForm = {
  name: "",
  ats: "greenhouse",
  slug: "",
  country: "",
  country_flag: "🌍",
  city: "",
  pipeline_local: false,
  pipeline_global: false,
  is_active: true,
};

// ── Pure transforms ───────────────────────────────────────────

/** Filters the company list by name, country, or ATS type (case-insensitive). */
export function filterCompanies(companies: ATSCompanyRow[], search: string): ATSCompanyRow[] {
  const q = search.toLowerCase();
  return companies.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.ats.toLowerCase().includes(q),
  );
}

/** Builds a CompanyForm from an existing ATSCompanyRow (used when starting an edit). */
export function formFromRow(c: ATSCompanyRow): CompanyForm {
  return {
    name: c.name,
    ats: c.ats,
    slug: c.slug,
    country: c.country,
    country_flag: c.country_flag,
    city: c.city ?? "",
    pipeline_local: c.pipeline_local,
    pipeline_global: c.pipeline_global,
    is_active: c.is_active,
  };
}
