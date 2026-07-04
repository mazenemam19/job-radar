// src/app/api/salary/route.ts
// Pure logic lives in lib/salary-route.ts (unit-testable without route mocks).

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";
import { aggregateSalaries, validateSalaryPost, type SalaryPostBody } from "@/lib/salary-route";
import type { EmploymentType, WorkArrangement, Pipeline } from "@/lib/types";

// ── GET /api/salary — aggregated charts data ──────────────

export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const roleFilter = url.searchParams.get("role");
  const pipelineFilter = url.searchParams.get("pipeline");

  const db = createServerClient();

  let query = db
    .from("salary_reports")
    .select("role_title, years_experience, currency, salary_egp, salary_usd, pipeline")
    .order("reported_at", { ascending: false })
    .limit(1000);

  if (roleFilter) {
    const safe = roleFilter.replace(/[%_]/g, "");
    query = query.ilike("role_title", `%${safe}%`);
  }
  if (pipelineFilter) query = query.eq("pipeline", pipelineFilter);

  const { data, error } = await query;
  if (error) return dbErrorResponse("salary:GET", error);

  return NextResponse.json({ ok: true, data: aggregateSalaries(data ?? []) });
}

// ── POST /api/salary — submit a report ────────────────────

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: SalaryPostBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateSalaryPost(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
  }

  // All required fields are guaranteed non-empty and valid after validateSalaryPost.
  const currency = body.currency!;

  const db = createServerClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("salary_reports")
    .insert({
      user_id: user.id,
      role_title: (body.role_title as string).trim(),
      years_experience: body.years_experience as number,
      salary_egp: body.salary_egp ?? null,
      salary_usd: body.salary_usd ?? null,
      currency,
      employment_type: body.employment_type ?? null,
      work_arrangement: body.work_arrangement ?? null,
      pipeline: body.pipeline ?? null,
      reported_at: now,
      last_updated_at: now,
    })
    .select()
    .single();

  if (error) return dbErrorResponse("salary:POST", error);

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
