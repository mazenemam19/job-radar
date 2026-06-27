// src/app/api/account/route.ts
// Self-service account deletion. A user who tried the app and didn't like it
// can permanently delete their own profile and everything linked to it.
//
// Tables linked to a user, and why each is handled the way it is:
//   - tracker_entries  (user_id, required FK)         — 0+ rows
//   - salary_reports   (user_id, nullable FK)          — 0+ rows (optional —
//       a user may never have submitted a salary report)
//   - user_jobs_cache  (user_id is the PK)              — 0 or 1 row
//   - user_settings    (user_id is the PK)               — 0 or 1 row
//   - user_profiles    (id is the PK)                    — exactly 1 row
//   - auth.users (Supabase Auth)                         — the account itself
//
// None of these deletes assume the row exists — Supabase's delete().eq(...)
// is a no-op (not an error) when nothing matches, so this is safe to run
// regardless of which optional data the user actually created.
//
// Order matters: every table that *references* the user is deleted first,
// the user_profiles row goes next, and the underlying auth account is
// removed last. If anything earlier fails, the user still has a working
// account and can simply try again — we never want to end up with an
// orphaned auth user that has no profile, or a half-deleted profile that
// still has an active login.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbErrorResponse, catchErrorResponse } from "@/lib/api-errors";

export async function DELETE() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();

  // ── 1. Dependent data (each optional — may be zero rows) ──────────────
  const { error: trackerError } = await db.from("tracker_entries").delete().eq("user_id", user.id);
  if (trackerError) return dbErrorResponse("account:DELETE:tracker_entries", trackerError);

  const { error: salaryError } = await db.from("salary_reports").delete().eq("user_id", user.id);
  if (salaryError) return dbErrorResponse("account:DELETE:salary_reports", salaryError);

  const { error: cacheError } = await db.from("user_jobs_cache").delete().eq("user_id", user.id);
  if (cacheError) return dbErrorResponse("account:DELETE:user_jobs_cache", cacheError);

  const { error: settingsError } = await db.from("user_settings").delete().eq("user_id", user.id);
  if (settingsError) return dbErrorResponse("account:DELETE:user_settings", settingsError);

  // ── 2. The profile row itself ──────────────────────────────────────────
  const { error: profileError } = await db.from("user_profiles").delete().eq("id", user.id);
  if (profileError) return dbErrorResponse("account:DELETE:user_profiles", profileError);

  // ── 3. The auth account — last, since it's irreversible ────────────────
  try {
    const { error: authError } = await db.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("[account:DELETE:auth_user]", authError.message);
      return NextResponse.json(
        { ok: false, error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }
  } catch (err) {
    return catchErrorResponse("account:DELETE:auth_user", err);
  }

  return NextResponse.json({ ok: true });
}
