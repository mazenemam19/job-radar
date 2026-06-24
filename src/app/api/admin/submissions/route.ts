// src/app/api/admin/submissions/route.ts

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("ats_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  if (error) return dbErrorResponse("admin/submissions:GET", error);
  return NextResponse.json({ ok: true, data });
}
