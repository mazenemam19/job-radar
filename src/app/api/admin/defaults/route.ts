// src/app/api/admin/defaults/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";
import { getDefaultSettings } from "@/lib/settings";
import { buildDefaultsPatch } from "@/lib/admin/build-defaults-patch";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const defaults = await getDefaultSettings();
  return NextResponse.json({ ok: true, data: defaults });
}

export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const result = buildDefaultsPatch(body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("default_settings")
    .update(result.patch)
    .eq("id", 1)
    .select()
    .single();

  if (error) return dbErrorResponse("admin/defaults:PUT", error);

  // Invalidate ALL user caches (their resolved settings have changed)
  await db
    .from("user_jobs_cache")
    .update({ cached_at: "2000-01-01T00:00:00Z" })
    .neq("user_id", "00000000-0000-0000-0000-000000000000"); // update all rows

  return NextResponse.json({ ok: true, data });
}
