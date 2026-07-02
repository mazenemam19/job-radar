// src/lib/admin/build-company-patch.ts
// Pure patch-builder for PUT /api/admin/companies/[id]. Kept separate from
// the route handler so it's unit-testable without mocking Next's
// request/response or Supabase.

import { VALID_ATS } from "@/lib/constants";
import type { ATSType } from "@/lib/types";
import type { Database } from "@/lib/database.types";

type CompanyPatch = Database["public"]["Tables"]["ats_companies"]["Update"];

const STRING_FIELDS = [
  "name",
  "ats",
  "slug",
  "country",
  "country_flag",
] as const satisfies readonly (keyof CompanyPatch)[];

const BOOLEAN_FIELDS = [
  "pipeline_local",
  "pipeline_global",
  "is_active",
] as const satisfies readonly (keyof CompanyPatch)[];

export type BuildPatchResult = { ok: true; patch: CompanyPatch } | { ok: false; error: string };

function assignFields(
  target: Record<string, unknown>,
  body: Record<string, unknown>,
  fields: readonly string[],
  typeName: "string" | "boolean",
): void {
  for (const field of fields) {
    if (field in body && typeof body[field] === typeName) {
      target[field] = body[field];
    }
  }
}

/** city is nullable, so it needs its own tri-state check (string / null /
 * anything else gets dropped) instead of the plain typeof check the other
 * fields use. */
function assignCity(patch: CompanyPatch, body: Record<string, unknown>): void {
  if ("city" in body) {
    patch.city = body.city === null || typeof body.city === "string" ? body.city : undefined;
  }
}

/** Builds the Supabase update patch from an admin PUT body. Unknown/invalid
 * keys are silently ignored (matches prior behavior); only an invalid `ats`
 * value fails validation. */
export function buildCompanyPatch(body: Record<string, unknown>): BuildPatchResult {
  if (body.ats && !VALID_ATS.includes(body.ats as ATSType)) {
    return { ok: false, error: "Invalid ATS type" };
  }

  const patch: CompanyPatch = { updated_at: new Date().toISOString() };
  const target = patch as Record<string, unknown>;

  assignFields(target, body, STRING_FIELDS, "string");
  assignFields(target, body, BOOLEAN_FIELDS, "boolean");
  assignCity(patch, body);

  return { ok: true, patch };
}
