// src/lib/submit-route.ts
// Pure validation logic for POST /api/submit.
// Kept separate from the route handler so it's unit-testable without
// mocking Next.js or Supabase.

import { VALID_ATS, COUNTRY_FLAGS } from "@/lib/constants";
import type { ATSType } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────

export type SubmitPostBody = {
  company_name?: unknown;
  ats_type?: unknown;
  slug?: unknown;
  country?: unknown;
  [key: string]: unknown;
};

export type SubmitValidationResult = { ok: true } | { ok: false; error: string };

// ── Validation ────────────────────────────────────────────────

/** Validates the required fields of a POST /api/submit body.
 *  Returns ok or the first validation error found. */
export function validateSubmitPost(body: SubmitPostBody): SubmitValidationResult {
  if (!body.company_name || !(body.company_name as string).trim()) {
    return { ok: false, error: "company_name is required" };
  }
  if (!VALID_ATS.includes(body.ats_type as ATSType)) {
    return { ok: false, error: "Invalid ats_type" };
  }
  if (!body.slug || !(body.slug as string).trim()) {
    return { ok: false, error: "slug is required" };
  }
  if (!body.country || !(body.country as string).trim()) {
    return { ok: false, error: "country is required" };
  }
  return { ok: true };
}

// ── Country flag lookup ───────────────────────────────────────

/** Returns the emoji flag for a country code, falling back to 🌍. */
export function countryFlag(countryCode: string): string {
  return COUNTRY_FLAGS[countryCode.toUpperCase()] ?? "🌍";
}
