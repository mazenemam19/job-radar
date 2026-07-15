// src/lib/gemini-review-cache.ts
// Persistent per-(user, job, prompt) cache of real Gemini decisions.
// See supabase/migrations/20260714000000_gemini_review_cache.sql for the
// full rationale: without this, every cache rebuild (every cron run --
// twice daily, see .github/workflows/cron.yml) re-asks Gemini about every
// job still inside the user's age window, even ones it already reviewed
// under the exact same prompt. Split out of gemini.ts so the persistence
// concern doesn't grow the API-calling module past its line limit.
//
// Only real (reviewed: true) decisions are ever written here -- fail-open
// results (quota exhausted, bad response, missing idx) are deliberately
// never persisted, so those jobs get retried on the next rebuild instead of
// being stuck "unreviewed" forever.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex");
}

export type CachedDecision = { pass: boolean; reason: string | null };

export async function loadCachedDecisions(
  db: SupabaseClient<Database>,
  userId: string,
  jobIds: string[],
  promptHash: string,
): Promise<Map<string, CachedDecision>> {
  const decisions = new Map<string, CachedDecision>();
  if (jobIds.length === 0) return decisions;

  // Not wrapped in @ts-expect-error: .select()/.eq()/.in() on an unrecognized
  // table name still type-checks (Postgrest's builder stays permissive here),
  // it's only .upsert() below that TypeScript rejects. The `data` result is
  // cast explicitly below since its inferred shape isn't trustworthy either.
  const { data, error } = await db
    .from("user_job_gemini_reviews")
    .select("job_id, gemini_pass, gemini_reason")
    .eq("user_id", userId)
    .eq("prompt_hash", promptHash)
    .in("job_id", jobIds);

  if (error) {
    // Cache read failure should never block real filtering -- fall through
    // to treating everything as uncached (i.e. send it all to Gemini).
    console.error("[gemini] Failed to load review cache, treating as empty:", error.message);
    return decisions;
  }

  for (const row of (data ?? []) as Array<{
    job_id: string;
    gemini_pass: boolean;
    gemini_reason: string | null;
  }>) {
    decisions.set(row.job_id, { pass: row.gemini_pass, reason: row.gemini_reason });
  }
  return decisions;
}

export async function persistDecisions(
  db: SupabaseClient<Database>,
  userId: string,
  promptHash: string,
  toPersist: Array<{ job_id: string; gemini_pass: boolean; gemini_reason: string | null }>,
): Promise<void> {
  if (toPersist.length === 0) return;

  const rows = toPersist.map((d) => ({
    user_id: userId,
    job_id: d.job_id,
    prompt_hash: promptHash,
    gemini_pass: d.gemini_pass,
    gemini_reason: d.gemini_reason,
    reviewed_at: new Date().toISOString(),
  }));

  // prettier-ignore
  // @ts-expect-error -- user_job_gemini_reviews isn't in the generated
  // Database types yet: that file is generated from a deployed project's
  // schema, and this table won't exist in any deployed project until
  // supabase/migrations/20260714000000_gemini_review_cache.sql is applied
  // and `supabase gen types typescript` is re-run. Remove this directive
  // once that regeneration happens -- if the error is gone, @ts-expect-error
  // will itself fail the build as a reminder (same pattern as
  // raw-jobs-query.ts's jr_get_filtered_raw_jobs call). Kept on one line and
  // prettier-ignore'd: @ts-expect-error only suppresses the error on the
  // exact next line, and Prettier re-wrapping this call moves the real error
  // to a different line than the directive, making it silently "unused".
  const { error } = await db.from("user_job_gemini_reviews").upsert(rows, { onConflict: "user_id,job_id" });

  if (error) {
    // Never let a cache-write failure fail the request -- worst case, these
    // jobs just get re-reviewed on the next rebuild instead of being cached.
    console.error("[gemini] Failed to persist review cache:", error.message);
  }
}
