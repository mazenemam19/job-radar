// src/app/api/admin/test-ats/route.ts
// Live-tests an ATS submission by calling the real fetcher with the provided slug.
// No jobs are stored. Result is written back to ats_submissions.test_result.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/v2/supabase/server";
import { createAdminClient } from "@/lib/v2/supabase/admin";
import { fetchCompany } from "@/lib/v2/ats-bridge";
import type { ATSCompanyRow, ATSTestResult, ATSType } from "@/lib/v2/types";
import type { Json } from "@/lib/v2/database.types";

async function requireAdmin() {
  const user = await getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data } = await db.from("user_profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin" ? user : null;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: { submission_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.submission_id) {
    return NextResponse.json({ ok: false, error: "submission_id is required" }, { status: 400 });
  }

  const db = createAdminClient();

  // Fetch the submission
  const { data: sub, error: subErr } = await db
    .from("ats_submissions")
    .select("*")
    .eq("id", body.submission_id)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
  }

  // Build a synthetic ATSCompanyRow for the bridge
  const mockRow: ATSCompanyRow = {
    id: sub.id,
    name: sub.company_name,
    ats: sub.ats_type as ATSType,
    slug: sub.slug,
    country: sub.country,
    country_flag: sub.country_flag,
    city: sub.city,
    pipeline_visa: sub.pipeline_visa,
    pipeline_local: sub.pipeline_local,
    pipeline_global: sub.pipeline_global,
    is_active: true,
    created_at: sub.submitted_at,
    updated_at: sub.submitted_at,
  };

  // Pick a mode to test with (any enabled pipeline)
  const mode = sub.pipeline_visa ? "visa" : sub.pipeline_local ? "local" : "global";

  // Run the actual fetch (test-only, nothing is stored)
  const result = await fetchCompany(mockRow, mode);

  const testResult: ATSTestResult = {
    ok: result.error === null,
    jobs_found: result.jobs.length,
    error: result.error,
    tested_at: new Date().toISOString(),
  };

  // Persist the test result on the submission row
  await db
    .from("ats_submissions")
    .update({ test_result: testResult as unknown as Json })
    .eq("id", sub.id);

  return NextResponse.json({ ok: true, data: testResult });
}
