// src/lib/auth.ts
// Shared auth helpers for API route handlers.

import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";

/**
 * Returns the authenticated user if they have role='admin', otherwise null.
 * Use at the top of every admin API route handler.
 *
 *   const admin = await requireAdmin();
 *   if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
 */
export async function requireAdmin(): Promise<User | null> {
  const user = await getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data } = await db.from("user_profiles").select("role").eq("id", user.id).single();
  return data?.role === "admin" ? user : null;
}
