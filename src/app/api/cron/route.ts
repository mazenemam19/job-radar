// src/app/api/cron/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runAllSources } from "@/lib/runner";

export const maxDuration = 60; // Vercel: allow up to 60s for scraping

export async function POST(req: NextRequest) {
  // In development, allow unauthenticated trigger (for the dashboard "Run Scan" button)
  const isDev = process.env.NODE_ENV === "development";
  const secret = req.headers.get("x-cron-secret");

  if (!isDev && secret !== process.env.CRON_SECRET) {
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
