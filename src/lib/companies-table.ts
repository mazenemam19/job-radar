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

/**
 * True when a company would be active with neither pipeline enabled — the
 * state that gets zero fetch tasks queued in fetchAllCompanyJobs (see
 * cron/fetch-jobs.ts) with nothing logged, not even a skip. Shared by the
 * public submit route and both admin company routes so the rule lives in
 * one place instead of three near-identical conditions.
 */
export function missingPipeline(
  isActive: boolean,
  pipelineLocal: boolean,
  pipelineGlobal: boolean,
): boolean {
  return isActive && !pipelineLocal && !pipelineGlobal;
}

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
