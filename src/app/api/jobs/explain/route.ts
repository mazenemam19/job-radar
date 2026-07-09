// src/app/api/jobs/explain/route.ts
// GET /api/jobs/explain?title=...&company=...
// Searches raw_jobs directly, with NO mode filter and NO 2000-row cap — the
// whole point is finding jobs the /pipeline gate-list breakdown would never
// surface, because they never entered the candidate pool in the first place.
// Runs each match through the same explainJob() trace used by the dashboard
// breakdown, so the two paths never disagree about why a job did or didn't
// make it.
//
// Auth: getUser() + resolveUserSettings(), same as /api/dashboard — this is
// a user checking their own settings against the raw pool, not an admin
// action, so requireAdmin() doesn't apply here.

import { NextResponse } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorResponse } from "@/lib/api-errors";
import { resolveUserSettings } from "@/lib/settings";
import { enabledModes } from "@/lib/dashboard-route";
import { explainJob } from "@/lib/explain";
import type { JobTraceResult } from "@/lib/explain";
import { filterJobsWithGeminiVerbose } from "@/lib/gemini";
import type { RawJob, ResolvedSettings } from "@/lib/types";

// Search-result cap, distinct from MAX_PIPELINE_SAMPLE — this bounds how
// many jobs a single (possibly broad) title/company search can match, since
// each match that survives every pre-Gemini gate costs one live Gemini call.
const MAX_MATCHES = 20;
// Defensive cap on the raw search input itself — a title/company field has
// no legitimate reason to be this long, and it keeps an oversized query
// string from reaching the ilike pattern at all.
const MAX_QUERY_LENGTH = 100;

/** Traces one job through every gate, fetching a live Gemini decision only
 *  if the job actually survives to that stage (most searched jobs won't, so
 *  the common case costs zero extra API calls). Pulled out of GET so the
 *  request handler reads as "validate → query → trace each match", not a
 *  single sprawling loop body. */
async function traceJob(
  job: RawJob,
  settings: ResolvedSettings,
  enabledPipelines: string[],
  geminiApiKey: string | null | undefined,
): Promise<JobTraceResult> {
  let explanation = explainJob(job, settings, null);
  const reachedGemini = explanation.gates.some((g) => g.gate === "gemini");
  const needsGemini = !reachedGemini && explanation.stoppedAt === null;

  if (needsGemini && geminiApiKey) {
    const [decision] = await filterJobsWithGeminiVerbose(geminiApiKey, [job], settings);
    explanation = explainJob(job, settings, decision ?? null);
  }

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    mode: job.mode,
    pipeline_match: enabledPipelines.includes(job.mode),
    stopped_at: explanation.stoppedAt,
    gates: explanation.gates,
    final_score: explanation.finalScore,
    gemini_pending: needsGemini && !geminiApiKey,
  };
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title")?.trim() ?? "").slice(0, MAX_QUERY_LENGTH);
  const company = (searchParams.get("company")?.trim() ?? "").slice(0, MAX_QUERY_LENGTH);

  if (!title && !company) {
    return NextResponse.json(
      { ok: false, error: "Provide a title or company to search for" },
      { status: 400 },
    );
  }

  const db = createServerClient();
  // raw_jobs is global, not user-owned — same service-role client as /api/dashboard.
  const adminDb = createAdminClient();

  const [settings, { data: profile }] = await Promise.all([
    resolveUserSettings(user.id),
    db.from("user_profiles").select("gemini_api_key").eq("id", user.id).single(),
  ]);

  let query = adminDb
    .from("raw_jobs")
    .select("*")
    .order("fetched_at", { ascending: false })
    .limit(MAX_MATCHES);
  if (title) query = query.ilike("title", `%${title}%`);
  if (company) query = query.ilike("company", `%${company}%`);

  const { data: matches, error } = await query;
  if (error) {
    return dbErrorResponse("jobs/explain:GET", error);
  }

  const enabled = enabledModes(settings);
  const results = await Promise.all(
    ((matches ?? []) as RawJob[]).map((job) =>
      traceJob(job, settings, enabled, profile?.gemini_api_key),
    ),
  );

  return NextResponse.json({ ok: true, data: { matches: results } });
}
