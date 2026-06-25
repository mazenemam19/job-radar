// src/app/api/dashboard/route.ts
// "Lazy C" model:
//   GET → if cache is fresh, return cached jobs instantly.
//         if stale → run user's Gemini filter + scoring → cache → return.
//
// The Gemini filter uses the user's own API key from user_profiles.gemini_api_key.
// First load after a cron run takes 10-15s; all subsequent opens are instant.

import { NextResponse } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorResponse } from "@/lib/api-errors";
import { resolveUserSettings } from "@/lib/settings";
import { filterJobsWithGemini } from "@/lib/gemini";
import {
  scoreJob,
  mergeJobs,
  passesDateGate,
  passesSettingsGate,
  passesGlobalModeGate,
} from "@/lib/scoring";
import { isCacheFresh } from "@/lib/runner";
import type { RawJob, ScoredJob, PipelineLog } from "@/lib/types";
import type { Json } from "@/lib/database.types";

export const maxDuration = 60; // Vercel: allow up to 60s for Gemini filter

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  // raw_jobs and app_config are global, not user-owned — RLS wasn't
  // checked/granted for them, so they stay on the service-role client.
  // See docs/plans/2026-06-23-phase4-data-access-migration.md, task 8.
  const adminDb = createAdminClient();

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

  // Read the previous cache's job IDs before we overwrite it — this is how
  // we know which jobs in the new result are genuinely new vs. already seen.
  // `hadPreviousCache` matters: on a user's very first-ever load there's
  // nothing to diff against, and every job would look "new" — we don't want
  // to email someone their entire initial match list as if it just appeared.
  const { data: previousCache } = await db
    .from("user_jobs_cache")
    .select("jobs")
    .eq("user_id", user.id)
    .single();

  const hadPreviousCache = !!previousCache;
  const previousJobIds = new Set(
    ((previousCache?.jobs as unknown as ScoredJob[]) ?? []).map((j) => j.id),
  );

  // Load user settings and profile (need API key)
  const [settings, { data: profile }] = await Promise.all([
    resolveUserSettings(user.id),
    db.from("user_profiles").select("gemini_api_key").eq("id", user.id).single(),
  ]);

  // Feature Request 2 (gemini-filter-audit.md): the Gemini key is now
  // optional — see the Step 4 branch below for what happens without one.

  // ── Step 1: Fetch raw jobs for enabled pipelines ─────────────
  const enabledModes: string[] = [];
  if (settings.pipeline_visa) enabledModes.push("visa");
  if (settings.pipeline_local) enabledModes.push("local");
  if (settings.pipeline_global) enabledModes.push("global");

  const { data: rawJobsData, error: rawError } = await adminDb
    .from("raw_jobs")
    .select("*")
    .in("mode", enabledModes)
    .order("fetched_at", { ascending: false })
    .limit(2000); // hard cap to keep Gemini context manageable

  if (rawError) {
    return dbErrorResponse("dashboard:GET", rawError);
  }

  const rawJobs = (rawJobsData ?? []) as RawJob[];
  const totalFetched = rawJobs.length;

  // ── Step 2: Date filter ──────────────────────────────────────
  const afterDateFilter = rawJobs.filter((j) => passesDateGate(j, settings.job_age_days));

  // ── Step 3: Settings filter (seniority + tech stack + regex gates) ──
  const afterSettingsFilter = afterDateFilter.filter((j) => passesSettingsGate(j, settings));

  // ── Step 3.5: Global mode timezone/region filter ─────────────
  // Only applies to jobs in the "global" pipeline. Uses per-user settings
  // (global_mode_blocked_regions / global_mode_allowed_locations) instead of
  // the old hardcoded isTimezoneIncompatible() in ats-utils.ts.
  const afterGlobalModeFilter = afterSettingsFilter.filter((j) =>
    j.mode === "global" ? passesGlobalModeGate(j, settings) : true,
  );

  // ── Step 4: Gemini filter ────────────────────────────────────
  // No key -> skip Gemini entirely rather than hard-blocking the whole
  // dashboard (the old behavior). An invalid/exhausted key already failed
  // open silently and showed everything anyway, so the strictest outcome
  // was backwards: reserved for the one case where the user did
  // everything right. Missing-key jobs get the same fail-open shape Bug
  // 1's matching already produces, so Feature Request 1's "Not
  // AI-reviewed" badge covers this for free.
  const geminiFiltered = profile?.gemini_api_key
    ? await filterJobsWithGemini(profile.gemini_api_key, afterGlobalModeFilter, settings)
    : afterGlobalModeFilter.map((j) => ({
        ...j,
        gemini_pass: true,
        gemini_reason: null,
        gemini_reviewed: false,
        gemini_quota_exhausted: false,
      }));

  // ── Step 5: Score ────────────────────────────────────────────
  const scoredJobs: ScoredJob[] = [];
  for (const job of geminiFiltered) {
    const scored = scoreJob(
      job,
      settings,
      job.gemini_pass,
      job.gemini_reason,
      job.gemini_reviewed,
      job.gemini_quota_exhausted,
    );
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
  const { data: appConfig } = await adminDb
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

  // Note: Job alert emails are sent from the cron job (runner.ts) after
  // the scrape completes, not from the dashboard route. This avoids the
  // mismatch where email shows pre-Gemini jobs but the dashboard shows
  // post-Gemini results. Users get a generic "scan complete" notification
  // and open the dashboard to see their personalized results.

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
