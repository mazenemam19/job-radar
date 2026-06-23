// src/app/api/admin/users/route.ts
// Admin-only: list all users with their settings summary.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("user_profiles")
    .select(
      `
      id, email, role, onboarding_complete, is_active,
      created_at, last_active_at,
      user_settings(uses_defaults)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, data });
}
