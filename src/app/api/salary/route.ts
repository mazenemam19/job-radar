// src/app/api/salary/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { dbErrorResponse } from "@/lib/api-errors";
import type {
  SalaryAggregate,
  SalaryCurrency,
  EmploymentType,
  WorkArrangement,
  Pipeline,
} from "@/lib/types";

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

  if (roleFilter) query = query.ilike("role_title", `%${roleFilter}%`);
  if (pipelineFilter) query = query.eq("pipeline", pipelineFilter);

  const { data, error } = await query;
  if (error) return dbErrorResponse("salary:GET", error);

  // Aggregate by role_title × years_experience × currency
  const aggregates = aggregateSalaries(data ?? []);

  return NextResponse.json({ ok: true, data: aggregates });
}

// ── POST /api/salary — submit a report ────────────────────

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: {
    role_title?: string;
    years_experience?: number;
    salary_egp?: number;
    salary_usd?: number;
    currency?: SalaryCurrency;
    employment_type?: EmploymentType;
    work_arrangement?: WorkArrangement;
    pipeline?: Pipeline;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.role_title || body.years_experience == null || !body.currency) {
    return NextResponse.json(
      { ok: false, error: "role_title, years_experience and currency are required" },
      { status: 400 },
    );
  }

  const VALID_CURRENCIES: SalaryCurrency[] = ["EGP", "USD", "EUR", "GBP"];
  if (!VALID_CURRENCIES.includes(body.currency)) {
    return NextResponse.json({ ok: false, error: "Invalid currency" }, { status: 400 });
  }

  const db = createServerClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("salary_reports")
    .insert({
      user_id: user.id,
      role_title: body.role_title.trim(),
      years_experience: body.years_experience,
      salary_egp: body.salary_egp ?? null,
      salary_usd: body.salary_usd ?? null,
      currency: body.currency,
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

// ── Aggregation helper ────────────────────────────────────────

type RawSalaryRow = {
  role_title: string;
  years_experience: number;
  currency: string;
  salary_egp: number | null;
  salary_usd: number | null;
  pipeline: string | null;
};

function aggregateSalaries(rows: RawSalaryRow[]): SalaryAggregate[] {
  type Key = string;
  const groups = new Map<Key, number[]>();
  const meta = new Map<Key, { role: string; exp: number; curr: string; pipeline: string | null }>();

  for (const row of rows) {
    const amount =
      row.currency === "EGP"
        ? row.salary_egp
        : row.currency === "USD"
          ? row.salary_usd
          : (row.salary_usd ?? row.salary_egp);

    if (amount == null) continue;

    // Bucket experience into bands: 0-2, 3-5, 6-9, 10+
    const expBand =
      row.years_experience < 3
        ? 1
        : row.years_experience < 6
          ? 4
          : row.years_experience < 10
            ? 7
            : 10;

    const key: Key = `${row.role_title}|${expBand}|${row.currency}|${row.pipeline ?? "all"}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      meta.set(key, {
        role: row.role_title,
        exp: expBand,
        curr: row.currency,
        pipeline: row.pipeline,
      });
    }
    groups.get(key)!.push(amount);
  }

  const results: SalaryAggregate[] = [];

  for (const [key, amounts] of groups) {
    if (amounts.length < 2) continue; // suppress micro-samples (privacy)

    const sorted = [...amounts].sort((a, b) => a - b);
    const m = meta.get(key)!;

    results.push({
      role_title: m.role,
      years_experience: m.exp,
      currency: m.curr as SalaryCurrency,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      median: sorted[Math.floor(sorted.length / 2)],
      count: sorted.length,
      pipeline: m.pipeline as Pipeline | null,
    });
  }

  return results.sort((a, b) => a.role_title.localeCompare(b.role_title));
}
