// src/app/api/v2/admin/companies/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/v2/supabase/server";
import { createAdminClient } from "@/lib/v2/supabase/admin";
import type { ATSType } from "@/lib/v2/types";

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

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_companies")
    .select("*")
    .order("name", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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
      pipeline_visa: Boolean(body.pipeline_visa),
      pipeline_local: Boolean(body.pipeline_local),
      pipeline_global: Boolean(body.pipeline_global),
      is_active: body.is_active !== false,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data }, { status: 201 });
}
