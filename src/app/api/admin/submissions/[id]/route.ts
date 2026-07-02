// src/app/api/admin/submissions/[id]/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";
import { buildSubmissionPatch } from "@/lib/admin/build-submission-patch";
import { approveSubmission } from "@/lib/admin/approve-submission";

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
    const result = await approveSubmission(db, params.id, body, now);
    if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 404 });
  }

  const patch = buildSubmissionPatch(body, admin.id, now);
  const { data, error } = await db
    .from("ats_submissions")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return dbErrorResponse("admin/submissions/[id]:PATCH", error);
  return NextResponse.json({ ok: true, data });
}

// ── DELETE — remove a submission ─────────────────────────────

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { error } = await db.from("ats_submissions").delete().eq("id", params.id);
  if (error) return dbErrorResponse("admin/submissions/[id]:DELETE", error);
  return NextResponse.json({ ok: true });
}
