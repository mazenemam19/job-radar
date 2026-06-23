// src/app/api/admin/submissions/[id]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

// ── PATCH — approve / reject / edit a submission ─────────────

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const db = createAdminClient();
  const now = new Date().toISOString();

  // If approving, also write to ats_companies
  if (body.status === "approved") {
    // Fetch the submission
    const { data: sub, error: subErr } = await db
      .from("ats_submissions")
      .select("*")
      .eq("id", params.id)
      .single();

    if (subErr || !sub) {
      return NextResponse.json({ ok: false, error: "Submission not found" }, { status: 404 });
    }

    // Create the company
    await db.from("ats_companies").insert({
      name: (body.name as string | undefined) ?? sub.company_name,
      ats: (body.ats_type as string | undefined) ?? sub.ats_type,
      slug: (body.slug as string | undefined) ?? sub.slug,
      country: sub.country,
      country_flag: sub.country_flag,
      city: sub.city,
      pipeline_visa: sub.pipeline_visa,
      pipeline_local: sub.pipeline_local,
      pipeline_global: sub.pipeline_global,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  }

  // Update submission status
  const patch: Database["public"]["Tables"]["ats_submissions"]["Update"] = {
    reviewed_at: now,
    reviewed_by: admin.id,
  };
  if (body.status && typeof body.status === "string") patch.status = body.status;
  if (body.slug && typeof body.slug === "string") patch.slug = body.slug;
  if (body.ats_type && typeof body.ats_type === "string") patch.ats_type = body.ats_type;

  const { data, error } = await db
    .from("ats_submissions")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

// ── DELETE — remove a submission ─────────────────────────────

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { error } = await db.from("ats_submissions").delete().eq("id", params.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
