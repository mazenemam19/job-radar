// src/app/api/v2/cron/route.ts
// New cron endpoint. Old /api/cron is untouched.
//
// Accepts both GET (Vercel Cron) and POST (GitHub Actions).
// Protected by CRON_SECRET header/query param.
//
// This endpoint ONLY runs the global scrape. Per-user Gemini filtering
// happens lazily when a user opens their dashboard ("Lazy C" model).

import { NextResponse, type NextRequest } from "next/server";
import { runCronJob } from "@/lib/v2/runner";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  // Check Authorization header (GitHub Actions / manual)
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  // Check query param (Vercel Cron GET)
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

function getTrigger(request: NextRequest): "github_actions" | "vercel_cron" | "manual" {
  const ua = request.headers.get("user-agent") ?? "";
  if (ua.includes("vercel")) return "vercel_cron";
  if (request.method === "POST") return "github_actions";
  return "manual";
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}

async function handler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCronJob(getTrigger(request));

    return NextResponse.json({
      ok: true,
      data: {
        total_fetched: result.total_fetched,
        duration_ms: result.duration_ms,
        error_count: result.errors.length,
        errors: result.errors.slice(0, 20), // truncate for response size
        trigger: result.trigger,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/v2/cron] Fatal error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
