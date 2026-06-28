// src/app/api/admin/companies/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";
import { VALID_ATS } from "@/lib/constants";
import type { ATSType } from "@/lib/types";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_companies")
    .select("*")
    .order("name", { ascending: true });

  if (error) return dbErrorResponse("admin/companies:GET", error);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.name || !VALID_ATS.includes(body.ats as ATSType) || !body.slug || !body.country) {
    return NextResponse.json(
      { ok: false, error: "name, ats, slug, country are required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from("ats_companies")
    .insert({
      name: body.name as string,
      ats: body.ats as string,
      slug: body.slug as string,
      country: body.country as string,
      country_flag: (body.country_flag as string) ?? "🌍",
      city: (body.city as string) ?? null,
      pipeline_local: Boolean(body.pipeline_local),
      pipeline_global: Boolean(body.pipeline_global),
      is_active: body.is_active !== false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return dbErrorResponse("admin/companies:POST", error);
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
