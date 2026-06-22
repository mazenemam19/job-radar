// src/app/api/admin/users/route.ts
// Admin-only: list all users with their settings summary.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
