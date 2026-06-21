// src/app/api/dashboard/route.ts
// "Lazy C" model:
//   GET → if cache is fresh, return cached jobs instantly.
//         if stale → run user's Gemini filter + scoring → cache → return.
//
// The Gemini filter uses the user's own API key from user_profiles.gemini_api_key.
// First load after a cron run takes 10-15s; all subsequent opens are instant.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/v2/supabase/server";
import { createAdminClient } from "@/lib/v2/supabase/admin";
import { resolveUserSettings } from "@/lib/v2/settings";
import { filterJobsWithGemini } from "@/lib/v2/gemini";
import { scoreJob, mergeJobs, passesDateGate, passesSettingsGate } from "@/lib/v2/scoring";
import { isCacheFresh } from "@/lib/v2/runner";
import type { RawJob, ScoredJob, PipelineLog } from "@/lib/v2/types";
import type { Json } from "@/lib/v2/database.types";

export const maxDuration = 60; // Vercel: allow up to 60s for Gemini filter

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Update last_active_at (fire and forget)
  db.from("user_profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", user.id)
    .then(() => {});

  // ── Cache check ──────────────────────────────────────────────
  const fresh = await isCacheFresh(user.id);

  if (fresh) {
    const { data: cache } = await db
      .from("user_jobs_cache")
      .select("jobs, pipeline_log, cached_at")
      .eq("user_id", user.id)
      .single();

    if (cache) {
      return NextResponse.json({
        ok: true,
        data: {
          jobs: cache.jobs as unknown as ScoredJob[],
          pipeline_log: cache.pipeline_log as unknown as PipelineLog,
          cached_at: cache.cached_at,
          from_cache: true,
        },
      });
    }
  }

  // ── Cache is stale — rebuild ─────────────────────────────────

  // Load user settings and profile (need API key)
  const [settings, { data: profile }] = await Promise.all([
    resolveUserSettings(user.id),
    db.from("user_profiles").select("gemini_api_key").eq("id", user.id).single(),
  ]);

  if (!profile?.gemini_api_key) {
    return NextResponse.json(
      { ok: false, error: "No Gemini API key configured. Please add one in Settings." },
      { status: 422 },
    );
  }

  // ── Step 1: Fetch raw jobs for enabled pipelines ─────────────
  const enabledModes: string[] = [];
  if (settings.pipeline_visa) enabledModes.push("visa");
  if (settings.pipeline_local) enabledModes.push("local");
  if (settings.pipeline_global) enabledModes.push("global");

  const { data: rawJobsData, error: rawError } = await db
    .from("raw_jobs")
    .select("*")
    .in("mode", enabledModes)
    .order("fetched_at", { ascending: false })
    .limit(2000); // hard cap to keep Gemini context manageable

  if (rawError) {
    return NextResponse.json({ ok: false, error: rawError.message }, { status: 500 });
  }

  const rawJobs = (rawJobsData ?? []) as RawJob[];
  const totalFetched = rawJobs.length;

  // ── Step 2: Date filter ──────────────────────────────────────
  const afterDateFilter = rawJobs.filter((j) => passesDateGate(j, settings.job_age_days));

  // ── Step 3: Settings filter (seniority + tech stack + regex gates) ──
  const afterSettingsFilter = afterDateFilter.filter((j) => passesSettingsGate(j, settings));

  // ── Step 4: Gemini filter ────────────────────────────────────
  const geminiFiltered = await filterJobsWithGemini(
    profile.gemini_api_key,
    afterSettingsFilter,
    settings,
  );

  // ── Step 5: Score ────────────────────────────────────────────
  const scoredJobs: ScoredJob[] = [];
  for (const job of geminiFiltered) {
    const scored = scoreJob(job, settings, job.gemini_pass, job.gemini_reason);
    if (scored && scored.total_score > 0) {
      scoredJobs.push(scored);
    }
  }

  // Merge deduplicates and sorts by total_score
  const finalJobs = mergeJobs([], scoredJobs);

  // ── Step 6: Build pipeline log ───────────────────────────────
  const pipelineLog: PipelineLog = {
    total_fetched: totalFetched,
    after_date_filter: afterDateFilter.length,
    after_settings_filter: afterSettingsFilter.length,
    after_gemini: finalJobs.length,
    cached_at: new Date().toISOString(),
  };

  // ── Step 7: Write cache ──────────────────────────────────────
  const { data: appConfig } = await db
    .from("app_config")
    .select("last_cron_at")
    .eq("id", 1)
    .single();

  await db.from("user_jobs_cache").upsert(
    {
      user_id: user.id,
      jobs: finalJobs as unknown as Json,
      cached_at: new Date().toISOString(),
      raw_pool_version: appConfig?.last_cron_at ?? null,
      pipeline_log: pipelineLog as unknown as Json,
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({
    ok: true,
    data: {
      jobs: finalJobs,
      pipeline_log: pipelineLog,
      cached_at: pipelineLog.cached_at,
      from_cache: false,
    },
  });
}
