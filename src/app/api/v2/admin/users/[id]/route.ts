// src/app/api/v2/admin/users/[id]/route.ts
// Admin-only: activate or block a user account.
// Role escalation is explicitly forbidden — `role` is stripped from all payloads.

import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/v2/supabase/server";
import { createAdminClient } from "@/lib/v2/supabase/admin";

import type { Database } from "@/lib/v2/database.types";

async function requireAdmin() {
  const user = await getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data } = await db.from("user_profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin" ? user : null;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // CRITICAL SECURITY: role can NEVER be set via any API endpoint.
  // It is silently stripped here and also immutable via RLS.
  delete body.role;
  delete body.id;
  delete body.email;

  // Only allow is_active to be changed via this endpoint
  const patch: Database["public"]["Tables"]["user_profiles"]["Update"] = {};
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  // Prevent admin from deactivating themselves
  if (params.id === admin.id && patch.is_active === false) {
    return NextResponse.json(
      { ok: false, error: "Cannot deactivate your own account" },
      { status: 400 },
    );
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("user_profiles")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data });
}
