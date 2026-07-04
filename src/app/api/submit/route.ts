// src/app/api/submit/route.ts
// Public endpoint — no authentication required.
// Inserts a row into ats_submissions with status='pending' for admin review.
// Pure validation logic lives in lib/submit-route.ts.

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorResponse } from "@/lib/api-errors";
import { validateSubmitPost, countryFlag } from "@/lib/submit-route";

// ---------------------------------------------------------------------------
// Rate limiting — module-level, in-memory.
// Not persistent across cold starts (serverless constraint — no Redis in this
// stack). Provides real protection against burst submissions from a single IP
// within a warm instance lifetime. Window: 5 submissions per 10 minutes.
// ---------------------------------------------------------------------------
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const ipLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_WINDOW_MS;
  const recent = (ipLog.get(ip) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX) return true;
  ipLog.set(ip, [...recent, now]);
  return false;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many submissions. Please try again later." },
      { status: 429 },
    );
  }

  let body: {
    company_name?: string;
    ats_type?: string;
    slug?: string;
    country?: string;
    city?: string;
    pipeline_local?: boolean;
    pipeline_global?: boolean;
    submitter_email?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateSubmitPost(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  const companyName = (body.company_name as string).trim();
  const atsType = body.ats_type as string;
  const slug = (body.slug as string).trim();
  const country = (body.country as string).trim();
  const flag = countryFlag(country);

  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_submissions")
    .insert({
      company_name: companyName,
      ats_type: atsType,
      slug: slug,
      country: country,
      country_flag: flag,
      city: body.city?.trim() ?? null,
      pipeline_local: Boolean(body.pipeline_local),
      pipeline_global: Boolean(body.pipeline_global),
      submitter_email: body.submitter_email?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return dbErrorResponse("submit:POST", error);

  return NextResponse.json({ ok: true, data: { id: data.id } }, { status: 201 });
}
