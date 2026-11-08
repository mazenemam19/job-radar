// src/app/api/salary/route.ts
// Pure logic lives in lib/salary-route.ts (unit-testable without route mocks).

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";
import { SalaryFxError, getUsdConversion } from "@/lib/salary-fx";
import {
  aggregateSalaries,
  getSubmittedAmount,
  validateSalaryPost,
  type RawSalaryRow,
  type SalaryPostBody,
} from "@/lib/salary-route";

type ConversionResolution =
  | { conversion: Awaited<ReturnType<typeof getUsdConversion>> }
  | { response: NextResponse };

type LegacySalaryLoad = { response: NextResponse } | { rows: RawSalaryRow[] };

async function resolveUsdConversion(
  amount: number,
  currency: NonNullable<SalaryPostBody["currency"]>,
): Promise<ConversionResolution> {
  try {
    return { conversion: await getUsdConversion(amount, currency) };
  } catch (error) {
    if (error instanceof SalaryFxError) {
      return {
        response: NextResponse.json(
          {
            ok: false,
            code: "salary:fx-unavailable",
            error: "A current USD conversion rate is unavailable. Please try again shortly.",
          },
          { status: 503 },
        ),
      };
    }
    throw error;
  }
}

function buildSalaryInsert(
  userId: string,
  body: SalaryPostBody,
  amount: number,
  currency: NonNullable<SalaryPostBody["currency"]>,
  conversion: Awaited<ReturnType<typeof getUsdConversion>>,
  now: string,
) {
  return {
    user_id: userId,
    role_title: (body.role_title as string).trim(),
    years_experience: body.years_experience as number,
    years_experience_exact: body.years_experience as number,
    // Keep the legacy columns populated for older readers while the original
    // amount/currency pair becomes the canonical representation.
    salary_egp: currency === "EGP" ? amount : null,
    salary_usd: currency === "USD" ? amount : null,
    currency,
    source: "user",
    source_record_key: null,
    original_amount: amount,
    original_currency: currency,
    usd_amount: conversion.usdAmount,
    usd_conversion_rate: conversion.usdConversionRate,
    usd_rate_as_of: conversion.usdRateAsOf,
    usd_rate_source: conversion.usdRateSource,
    employment_type: body.employment_type ?? null,
    work_arrangement: body.work_arrangement ?? null,
    pipeline: body.pipeline ?? null,
    reported_at: now,
    last_updated_at: now,
  };
}

/**
 * Deployments must apply the tracked provenance migration before accepting
 * salary submissions. Reads retain a narrow fallback so a temporarily stale
 * PostgREST schema cache cannot turn the entire explorer into a 500.
 */
function isSalaryProvenanceSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("message" in error)) return false;
  const message = String(error.message);
  return (
    message.includes("years_experience_exact") ||
    message.includes("usd_amount") ||
    message.includes("original_amount")
  );
}

// ── GET /api/salary — aggregated charts data ──────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const roleFilter = url.searchParams.get("role");
  const pipelineFilter = url.searchParams.get("pipeline");

  const db = await createServerClient();

  let query = db
    .from("salary_reports")
    .select(
      "role_title, years_experience, years_experience_exact, usd_amount, pipeline, reported_at",
    )
    .order("reported_at", { ascending: false })
    .limit(1000);

  if (roleFilter) {
    const safe = roleFilter.replace(/[%_]/g, "");
    query = query.ilike("role_title", `%${safe}%`);
  }
  if (pipelineFilter) query = query.eq("pipeline", pipelineFilter);

  const { data, error } = await query;
  if (error && !isSalaryProvenanceSchemaError(error)) return dbErrorResponse("salary:GET", error);

  let rows: RawSalaryRow[] = data ?? [];
  if (error) {
    const legacyResult = await loadLegacySalaryRows();
    if ("response" in legacyResult) return legacyResult.response;
    rows = legacyResult.rows;
  }

  return NextResponse.json({
    ok: true,
    data: aggregateSalaries(rows),
    meta: {
      skipped_unconverted_count: rows.filter((row) => row.usd_amount == null).length,
    },
  });

  async function loadLegacySalaryRows(): Promise<LegacySalaryLoad> {
    let legacyQuery = db
      .from("salary_reports")
      .select(
        "role_title, years_experience, currency, salary_egp, salary_usd, pipeline, reported_at",
      )
      .order("reported_at", { ascending: false })
      .limit(1000);

    if (roleFilter) {
      const safe = roleFilter.replace(/[%_]/g, "");
      legacyQuery = legacyQuery.ilike("role_title", `%${safe}%`);
    }
    if (pipelineFilter) legacyQuery = legacyQuery.eq("pipeline", pipelineFilter);

    const { data: legacyData, error: legacyError } = await legacyQuery;
    if (legacyError) return { response: dbErrorResponse("salary:GET:legacy", legacyError) };

    // Only a legacy USD value can be shown in the normalized chart. The old
    // schema has no rate provenance for EGP/EUR/GBP, so those rows remain
    // visibly excluded instead of being converted with a guessed rate.
    return {
      rows: (legacyData ?? []).map((row) => ({
        role_title: row.role_title,
        years_experience: row.years_experience,
        years_experience_exact: null,
        usd_amount: row.currency === "USD" ? row.salary_usd : null,
        pipeline: row.pipeline,
        reported_at: row.reported_at,
      })),
    };
  }
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

  // All required fields are guaranteed valid after validateSalaryPost.
  const currency = body.currency!;
  const amount = getSubmittedAmount(body)!;

  const conversionResult = await resolveUsdConversion(amount, currency);
  if ("response" in conversionResult) return conversionResult.response;
  const { conversion } = conversionResult;

  const db = await createServerClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("salary_reports")
    .insert(buildSalaryInsert(user.id, body, amount, currency, conversion, now))
    .select()
    .single();

  if (error && isSalaryProvenanceSchemaError(error)) {
    return NextResponse.json(
      {
        ok: false,
        code: "salary:schema-upgrade-required",
        error:
          "Salary submissions are temporarily unavailable while a required database update is applied. Please try again shortly.",
      },
      { status: 503 },
    );
  }
  if (error) return dbErrorResponse("salary:POST", error);

  return NextResponse.json({ ok: true, data }, { status: 201 });
}
