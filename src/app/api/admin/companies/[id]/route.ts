// src/app/api/admin/companies/[id]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";
import { buildCompanyPatch } from "@/lib/admin/build-company-patch";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = buildCompanyPatch(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_companies")
    .update(result.patch)
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
