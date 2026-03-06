// src/app/api/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAllSources } from "@/lib/runner";

export const maxDuration = 300; // Allow up to 5min for all 3 pipelines

async function handleCron(req: NextRequest) {
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  // Dashboard button sends: x-cron-secret header
  const authHeader = req.headers.get("authorization");
  const legacySecret = req.headers.get("x-cron-secret");
  const token = authHeader?.replace("Bearer ", "").trim() ?? legacySecret;

  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const log = await runAllSources();
    return NextResponse.json({ ok: true, log });
  } catch (err) {
    console.error("[/api/cron] Fatal:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// GET: called by Vercel Cron scheduler automatically at 4pm UTC (6pm Cairo)
export async function GET(req: NextRequest) {
  return handleCron(req);
}

// POST: called by dashboard "Run Scan" button
export async function POST(req: NextRequest) {
  return handleCron(req);
}
