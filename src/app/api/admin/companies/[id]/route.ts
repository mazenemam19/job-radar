// src/app/api/admin/companies/[id]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";
import { VALID_ATS } from "@/lib/constants";
import type { ATSType } from "@/lib/types";
import type { Database } from "@/lib/database.types";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (body.ats && !VALID_ATS.includes(body.ats as ATSType)) {
    return NextResponse.json({ ok: false, error: "Invalid ATS type" }, { status: 400 });
  }

  const patch: Database["public"]["Tables"]["ats_companies"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if ("name" in body && typeof body.name === "string") patch.name = body.name;
  if ("ats" in body && typeof body.ats === "string") patch.ats = body.ats;
  if ("slug" in body && typeof body.slug === "string") patch.slug = body.slug;
  if ("country" in body && typeof body.country === "string") patch.country = body.country;
  if ("country_flag" in body && typeof body.country_flag === "string")
    patch.country_flag = body.country_flag;
  if ("city" in body)
    patch.city = body.city === null || typeof body.city === "string" ? body.city : undefined;
  if ("pipeline_local" in body && typeof body.pipeline_local === "boolean")
    patch.pipeline_local = body.pipeline_local;
  if ("pipeline_global" in body && typeof body.pipeline_global === "boolean")
    patch.pipeline_global = body.pipeline_global;
  if ("is_active" in body && typeof body.is_active === "boolean") patch.is_active = body.is_active;

  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_companies")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return dbErrorResponse("admin/companies/[id]:PUT", error);
  if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();

  // Fetch the company first so we can clean up its raw_jobs entries by name.
  // raw_jobs has no FK to ats_companies (linked by company name + ats_type),
  // so orphaned jobs would linger in the pool forever after deletion.
  const { data: company } = await db
    .from("ats_companies")
    .select("name, ats")
    .eq("id", params.id)
    .single();

  // Delete raw_jobs that belong to this company (matched by name + ats)
  if (company) {
    await db.from("raw_jobs").delete().eq("ats_type", company.ats).eq("company", company.name);
  }

  // Delete the company itself
  const { error } = await db.from("ats_companies").delete().eq("id", params.id);

  if (error) return dbErrorResponse("admin/companies/[id]:DELETE", error);
  return NextResponse.json({ ok: true });
}
