// src/lib/admin/approve-submission.ts
// Approval side-effect for PATCH /api/admin/submissions/[id]: fetches the
// submission and inserts the resulting ats_companies row. Kept out of the
// route handler so the handler's branching stays flat and the flow here is
// unit-testable with a mocked db client.

import type { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type AdminDb = ReturnType<typeof createClient<Database>>;

export type ApproveResult = { ok: true } | { ok: false; error: string };

/** Body overrides (name/ats_type/slug) win over the submission's own values,
 * matching prior route behavior. */
export async function approveSubmission(
  db: AdminDb,
  submissionId: string,
  body: Record<string, unknown>,
  now: string,
): Promise<ApproveResult> {
  const { data: sub, error: subErr } = await db
    .from("ats_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (subErr || !sub) {
    return { ok: false, error: "Submission not found" };
  }

  await db.from("ats_companies").insert({
    name: (body.name as string | undefined) ?? sub.company_name,
    ats: (body.ats_type as string | undefined) ?? sub.ats_type,
    slug: (body.slug as string | undefined) ?? sub.slug,
    country: sub.country,
    country_flag: sub.country_flag,
    city: sub.city,
    pipeline_local: sub.pipeline_local,
    pipeline_global: sub.pipeline_global,
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  return { ok: true };
}
