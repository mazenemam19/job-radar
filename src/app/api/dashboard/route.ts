// src/app/api/dashboard/route.ts
// "Lazy C" model:
//   GET → if cache is fresh, return cached jobs instantly.
//         if stale → run user's Gemini filter + scoring → cache → return.
//
// The Gemini filter uses the user's own API key from user_profiles.gemini_api_key.
// First load after a cron run takes 10-15s; all subsequent opens are instant.
//
// Rebuild logic lives in lib/dashboard-route.ts (pure, unit-testable).

import { NextResponse } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorResponse } from "@/lib/api-errors";
import { resolveUserSettings } from "@/lib/settings";
import { isCacheFresh } from "@/lib/runner";
import { buildFeed, enabledModes } from "@/lib/dashboard-route";
import type {
  RawJob,
  ScoredJob,
  PipelineLog,
  IngestionLog,
  JobMode,
  WrongModeEntry,
  OutsideWindowEntry,
} from "@/lib/types";
import { MAX_PIPELINE_SAMPLE } from "@/lib/types";
import type { Json } from "@/lib/database.types";

const ALL_MODES: JobMode[] = ["local", "global"];

export const maxDuration = 60; // Vercel: allow up to 60s for Gemini filter

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();
  // raw_jobs and app_config are global, not user-owned — RLS wasn't
  // checked/granted for them, so they stay on the service-role client.
  const adminDb = createAdminClient();

  // Update last_active_at (fire and forget)
  db.from("user_profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", user.id)
    .then(() => {});

  // Load user settings and profile (need API key)
  const [settings, { data: profile }] = await Promise.all([
    resolveUserSettings(user.id),
    db.from("user_profiles").select("gemini_api_key").eq("id", user.id).single(),
  ]);

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
          settings,
        },
      });
    }
  }

  // ── Fetch raw jobs for enabled pipelines, plus everything needed to
  //    explain ingestion-level losses that happen before any gate runs ────
  const enabled = enabledModes(settings);
  const disabledModes = ALL_MODES.filter((m) => !enabled.includes(m));

  const [
    { data: rawJobsData, error: rawError },
    { count: totalScraped },
    { count: matchedPipelines },
    { data: wrongModeSample },
    { data: outsideWindowSample },
  ] = await Promise.all([
    adminDb
      .from("raw_jobs")
      .select("*")
      .in("mode", enabled)
      .order("fetched_at", { ascending: false })
      .limit(2000), // hard cap to keep Gemini context manageable
    adminDb.from("raw_jobs").select("*", { count: "exact", head: true }),
    adminDb.from("raw_jobs").select("*", { count: "exact", head: true }).in("mode", enabled),
    // Jobs whose mode isn't one of the user's enabled pipelines — never seen
    // by any gate. Skipped entirely when nothing is disabled (nothing to find).
    disabledModes.length > 0
      ? adminDb
          .from("raw_jobs")
          .select("id, title, company, mode")
          .in("mode", disabledModes)
          .order("fetched_at", { ascending: false })
          .limit(MAX_PIPELINE_SAMPLE)
      : Promise.resolve({ data: [] as WrongModeEntry[] }),
    // Jobs that matched the user's mode(s) but rank past the 2000-row cap —
    // same filter/order as the main query, shifted past row 2000.
    adminDb
      .from("raw_jobs")
      .select("id, title, company, fetched_at")
      .in("mode", enabled)
      .order("fetched_at", { ascending: false })
      .range(2000, 2000 + MAX_PIPELINE_SAMPLE - 1),
  ]);

  if (rawError) {
    return dbErrorResponse("dashboard:GET", rawError);
  }

  // These are supplementary breakdown numbers, not the core candidate pool —
  // best-effort rather than failing the whole dashboard load if one of them
  // errors (e.g. a transient count-query issue shouldn't block someone's jobs).
  const matchedPipelinesCount = matchedPipelines ?? rawJobsData?.length ?? 0;
  const ingestionLog: IngestionLog = {
    total_scraped: totalScraped ?? matchedPipelinesCount,
    matched_pipelines: matchedPipelinesCount,
    wrong_pipeline_mode: {
      count: Math.max(0, (totalScraped ?? matchedPipelinesCount) - matchedPipelinesCount),
      enabled_pipelines: enabled,
      sample: (wrongModeSample ?? []) as WrongModeEntry[],
    },
    outside_candidate_window: {
      count: Math.max(0, matchedPipelinesCount - 2000),
      sample: (outsideWindowSample ?? []) as OutsideWindowEntry[],
    },
  };

  // ── Run pipeline (date → gates → global-mode → Gemini → score → merge) ─
  const { finalJobs, gateLog } = await buildFeed(
    (rawJobsData ?? []) as RawJob[],
    settings,
    profile?.gemini_api_key,
  );

  const pipelineLog: PipelineLog = {
    ...ingestionLog,
    ...gateLog,
    cached_at: new Date().toISOString(),
  };

  // ── Write cache ──────────────────────────────────────────────
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
      settings,
    },
  });
}
