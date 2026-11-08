// src/app/api/cron/route.ts
// New cron endpoint. Old /api/cron is untouched.
//
// Accepts both GET (Vercel Cron) and POST (GitHub Actions).
// Protected by CRON_SECRET header/query param.
//
// This endpoint ONLY runs the global scrape. Per-user Gemini filtering
// happens lazily when a user opens their dashboard ("Lazy C" model).

import { NextResponse, type NextRequest } from "next/server";
import { catchErrorResponse } from "@/lib/api-errors";
import { requireAdmin } from "@/lib/auth";
import { acquireCronRunLock, releaseCronRunLock } from "@/lib/cron/run-lock";
import { runCronJob } from "@/lib/runner";
import { createAdminClient } from "@/lib/supabase/admin";

// Hobby + Fluid Compute already defaults to 300s — this can't buy more time,
// it's here so the ceiling is explicit instead of an assumed default.
export const maxDuration = 300;

type CronTrigger = Parameters<typeof runCronJob>[0];

/**
 * Scheduled callers present CRON_SECRET. An authenticated admin may make a
 * POST from the protected UI; GET remains secret-only so a page prefetch or
 * link cannot trigger a live run.
 */
async function getAuthorization(request: NextRequest): Promise<{ trigger: CronTrigger } | null> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const url = new URL(request.url);
  const hasCronSecret =
    Boolean(secret) &&
    (authHeader === `Bearer ${secret}` || url.searchParams.get("secret") === secret);

  if (hasCronSecret) return { trigger: getScheduledTrigger(request) };

  if (request.method !== "POST") return null;

  const admin = await requireAdmin();
  return admin ? { trigger: "manual" } : null;
}

function getScheduledTrigger(request: NextRequest): CronTrigger {
  const ua = request.headers.get("user-agent") ?? "";
  if (ua.includes("vercel")) return "vercel_cron";
  return request.method === "POST" ? "github_actions" : "vercel_cron";
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  const authorization = await getAuthorization(request);
  if (!authorization) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  let lock: Awaited<ReturnType<typeof acquireCronRunLock>> = null;

  try {
    lock = await acquireCronRunLock(db);
    if (!lock) {
      return NextResponse.json(
        {
          ok: false,
          code: "cron:busy",
          error: "A cron run is already in progress. Wait for it to finish before starting another.",
        },
        { status: 409 },
      );
    }

    const result = await runCronJob(authorization.trigger);

    return NextResponse.json({
      ok: true,
      data: {
        total_fetched: result.total_fetched,
        duration_ms: result.duration_ms,
        error_count: result.errors.length,
        errors: result.errors.slice(0, 20), // truncate for response size
        warning_count: result.warnings.length,
        warnings: result.warnings.slice(0, 20),
        source_health: result.source_health,
        email_sent_count: result.email_results?.filter((r) => r.sent).length ?? 0,
        email_failed_count: result.email_results?.filter((r) => !r.sent).length ?? 0,
        trigger: result.trigger,
      },
    });
  } catch (err) {
    return catchErrorResponse("cron", err);
  } finally {
    try {
      await releaseCronRunLock(db, lock);
    } catch (lockError) {
      // A stale lock is recoverable. Preserve the successful cron response,
      // but leave an actionable server-side diagnostic for follow-up.
      console.error(
        "[cron] lock release failed:",
        lockError instanceof Error ? lockError.message : String(lockError),
      );
    }
  }
}
