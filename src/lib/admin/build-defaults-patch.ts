// src/lib/admin/build-defaults-patch.ts
// Pure patch-builder for PUT /api/admin/defaults. Kept separate from the
// route handler so it's unit-testable without mocking Next's request/response
// or Supabase.

import type { Database } from "@/lib/database.types";

type DefaultsPatch = Database["public"]["Tables"]["default_settings"]["Update"];

const STRING_ARRAY_FIELDS = [
  "expert_skills",
  "secondary_skills",
  "bonus_skills",
  "excluded_keywords",
  "blacklisted_locations",
  "required_keywords",
  "global_mode_blocked_regions",
  "global_mode_allowed_locations",
  "junior_keywords",
  "mid_keywords",
  "senior_keywords",
  "staff_keywords",
  "seniority_levels",
] as const satisfies readonly (keyof DefaultsPatch)[];

const NUMBER_FIELDS = [
  "job_age_days",
  "score_denominator",
] as const satisfies readonly (keyof DefaultsPatch)[];

const BOOLEAN_FIELDS = [
  "pipeline_local",
  "pipeline_global",
] as const satisfies readonly (keyof DefaultsPatch)[];

function assignStringArrayFields(
  target: Record<string, unknown>,
  body: Record<string, unknown>,
): void {
  for (const field of STRING_ARRAY_FIELDS) {
    if (field in body && Array.isArray(body[field])) {
      target[field] = (body[field] as unknown[]).filter((v): v is string => typeof v === "string");
    }
  }
}

function assignTypedFields<T>(
  target: Record<string, unknown>,
  body: Record<string, unknown>,
  fields: readonly string[],
  typeName: "number" | "boolean",
): void {
  for (const field of fields) {
    if (field in body && typeof body[field] === typeName) {
      target[field] = body[field] as T;
    }
  }
}

export type BuildPatchResult = { ok: true; patch: DefaultsPatch } | { ok: false; error: string };

type ScoringWeightsResult =
  | { ok: true; weights: { skill: number; recency: number; relocation: number } | undefined }
  | { ok: false; error: string };

/** Validates and normalizes scoring_weights. weights: undefined means the
 * field wasn't a usable object (matches prior no-op behavior). */
function parseScoringWeights(value: unknown): ScoringWeightsResult {
  if (!value || typeof value !== "object") return { ok: true, weights: undefined };

  const w = value as Record<string, unknown>;
  const skill = typeof w.skill === "number" ? w.skill : 0;
  const recency = typeof w.recency === "number" ? w.recency : 0;
  const relocation = typeof w.relocation === "number" ? w.relocation : 0;

  if (Math.abs(skill + recency + relocation - 1) > 0.01) {
    return { ok: false, error: "scoring_weights must sum to 1" };
  }
  return { ok: true, weights: { skill, recency, relocation } };
}

/** Builds the Supabase update patch from an admin PUT body. Unknown/invalid
 * keys are silently ignored (matches prior behavior); only scoring_weights
 * can fail validation. */
export function buildDefaultsPatch(body: Record<string, unknown>): BuildPatchResult {
  const patch: DefaultsPatch = { updated_at: new Date().toISOString() };
  const target = patch as Record<string, unknown>;

  assignStringArrayFields(target, body);
  assignTypedFields<number>(target, body, NUMBER_FIELDS, "number");
  assignTypedFields<boolean>(target, body, BOOLEAN_FIELDS, "boolean");

  if ("gemini_filter_prompt" in body) {
    patch.gemini_filter_prompt =
      typeof body.gemini_filter_prompt === "string" ? body.gemini_filter_prompt : null;
  }

  if ("scoring_weights" in body) {
    const result = parseScoringWeights(body.scoring_weights);
    if (!result.ok) return result;
    if (result.weights) patch.scoring_weights = result.weights;
  }

  return { ok: true, patch };
}
