// src/lib/submit-route.ts
// Pure validation logic for POST /api/submit.
// Kept separate from the route handler so it's unit-testable without
// mocking Next.js or Supabase.

import { VALID_ATS, COUNTRY_FLAGS } from "@/lib/constants";
import { missingPipeline } from "@/lib/companies-table";
import type { ATSType } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────

/**
 * The parsed JSON body of POST /api/submit.
 * Fields are optional strings to reflect that `request.json()` may return
 * anything — but all values are typed to their expected domain types so
 * TypeScript can check usage after validation narrows them.
 */
export type SubmitPostBody = {
  company_name?: string;
  ats_type?: string;
  slug?: string;
  country?: string;
  city?: string;
  pipeline_local?: boolean;
  pipeline_global?: boolean;
  submitter_email?: string;
};

export type SubmitValidationResult = { ok: true } | { ok: false; error: string };

// ── Validation ────────────────────────────────────────────────

/** Validates the required fields of a POST /api/submit body.
 *  Returns ok or the first validation error found. */
export function validateSubmitPost(body: SubmitPostBody): SubmitValidationResult {
  if (!body.company_name?.trim()) {
    return { ok: false, error: "company_name is required" };
  }
  if (!VALID_ATS.includes(body.ats_type as ATSType)) {
    return { ok: false, error: "Invalid ats_type" };
  }
  if (!body.slug?.trim()) {
    return { ok: false, error: "slug is required" };
  }
  if (!body.country?.trim()) {
    return { ok: false, error: "country is required" };
  }
  if (missingPipeline(true, Boolean(body.pipeline_local), Boolean(body.pipeline_global))) {
    return { ok: false, error: "At least one pipeline (local or global) is required" };
  }
  return { ok: true };
}

// ── Country flag lookup ───────────────────────────────────────

/** Returns the emoji flag for a country code, falling back to 🌍. */
export function countryFlag(countryCode: string): string {
  return COUNTRY_FLAGS[countryCode.toUpperCase()] ?? "🌍";
}
