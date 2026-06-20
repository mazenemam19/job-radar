// src/app/api/v2/admin/companies/[id]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/v2/supabase/server";
import { createAdminClient } from "@/lib/v2/supabase/admin";
import type { ATSType } from "@/lib/v2/types";

import type { Database } from "@/lib/v2/database.types";

const VALID_ATS: ATSType[] = [
  "greenhouse",
  "lever",
  "ashby",
  "workable",
  "teamtailor",
  "breezy",
  "smartrecruiters",
  "bamboohr",
  "jazzhr",
];

async function requireAdmin() {
  const user = await getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data } = await db.from("user_profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin" ? user : null;
}

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
  if ("pipeline_visa" in body && typeof body.pipeline_visa === "boolean")
    patch.pipeline_visa = body.pipeline_visa;
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

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { error } = await db.from("ats_companies").delete().eq("id", params.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
