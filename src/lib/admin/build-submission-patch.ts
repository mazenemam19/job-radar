// src/lib/admin/build-submission-patch.ts
// Pure patch-builder for PATCH /api/admin/submissions/[id]. Kept separate
// from the route handler so it's unit-testable without mocking Next's
// request/response or Supabase.

import type { Database } from "@/lib/database.types";

type SubmissionPatch = Database["public"]["Tables"]["ats_submissions"]["Update"];

const STRING_FIELDS = [
  "status",
  "slug",
  "ats_type",
] as const satisfies readonly (keyof SubmissionPatch)[];

/** Always sets reviewed_at/reviewed_by; only copies status/slug/ats_type
 * from the body when present and typeof string (matches prior behavior). */
export function buildSubmissionPatch(
  body: Record<string, unknown>,
  adminId: string,
  now: string,
): SubmissionPatch {
  const patch: SubmissionPatch = { reviewed_at: now, reviewed_by: adminId };
  const target = patch as Record<string, unknown>;

  for (const field of STRING_FIELDS) {
    if (typeof body[field] === "string") target[field] = body[field];
  }

  return patch;
}
