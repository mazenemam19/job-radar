// src/app/auth/callback/route.ts
// Handles the Google OAuth redirect after Supabase Auth authenticates the user.
// Exchanges the code for a session, creates/updates the user_profiles row,
// then redirects to onboarding (new user) or dashboard (returning user).

import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", origin));
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    console.error("[auth/callback] Session exchange failed:", error?.message);
    return NextResponse.redirect(new URL("/login?error=auth_failed", origin));
  }

  const user = data.user;
  const db = createAdminClient();

  // Upsert user_profiles row
  // IMPORTANT: `role` defaults to 'user' via DB constraint. We NEVER set it here.
  // The only way to make someone admin is direct DB access (service role).
  const { error: profileError } = await db.from("user_profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      last_active_at: new Date().toISOString(),
      // onboarding_complete and role are NOT set here — DB defaults apply on insert.
      // On conflict (returning user) we only update last_active_at.
    },
    {
      onConflict: "id",
      // Only update last_active_at on conflict; never touch role or onboarding_complete
      ignoreDuplicates: false,
    },
  );

  if (profileError) {
    // Non-fatal: log but continue (user can still use the app)
    console.error("[auth/callback] Profile upsert error:", profileError.message);
  }

  // Check onboarding status to determine redirect
  const { data: profile } = await db
    .from("user_profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  const destination = profile?.onboarding_complete
    ? next.startsWith("/")
      ? next
      : "/dashboard"
    : "/onboarding";

  return NextResponse.redirect(new URL(destination, origin));
}
