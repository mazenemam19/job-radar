// src/app/api/settings/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { getUser, createServerClient } from "@/lib/supabase/server";
import { dbErrorResponse, catchErrorResponse } from "@/lib/api-errors";
import {
  resolveUserSettings,
  saveUserSettings,
  initializeUserSettingsForSignup,
} from "@/lib/settings";

// ── GET /api/settings ─────────────────────────────────────

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const [resolved, db] = await Promise.all([resolveUserSettings(user.id), createServerClient()]);

  // Also return the raw user settings row (for the form's initial state)
  const { data: rawSettings, error: rawSettingsError } = await db
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .single();
  if (rawSettingsError && rawSettingsError.code !== "PGRST116") {
    return dbErrorResponse("settings:GET:user_settings", rawSettingsError);
  }

  const { data: profile, error: profileError } = await db
    .from("user_profiles")
    .select("email, gemini_api_key, onboarding_complete")
    .eq("id", user.id)
    .single();
  if (profileError) return dbErrorResponse("settings:GET:user_profile", profileError);

  return NextResponse.json({
    ok: true,
    data: {
      resolved,
      raw: rawSettings ?? null,
      profile: {
        email: profile?.email,
        has_gemini_key: Boolean(profile?.gemini_api_key),
        onboarding_complete: profile?.onboarding_complete,
      },
    },
  });
}

// ── PATCH /api/settings ───────────────────────────────────

export async function PATCH(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Strip any attempt to set role (security guard — role is immutable from app layer)
  delete body.role;

  const db = await createServerClient();

  // Handle gemini_api_key separately (stored in user_profiles, not user_settings)
  if ("gemini_api_key" in body) {
    const key = typeof body.gemini_api_key === "string" ? body.gemini_api_key.trim() : null;

    const { error: keyError } = await db
      .from("user_profiles")
      .update({ gemini_api_key: key || null })
      .eq("id", user.id);

    if (keyError) {
      return dbErrorResponse("settings:PATCH", keyError);
    }

    delete body.gemini_api_key;
  }

  // Handle onboarding_complete separately
  if (body.onboarding_complete === true) {
    const { error: onboardingError } = await db
      .from("user_profiles")
      .update({ onboarding_complete: true })
      .eq("id", user.id);
    if (onboardingError) {
      return dbErrorResponse("settings:PATCH:onboarding_complete", onboardingError);
    }

    // One-time snapshot: copy today's defaults into this user's row so
    // later admin changes to default_settings never affect them.
    try {
      await initializeUserSettingsForSignup(user.id);
    } catch (err) {
      return catchErrorResponse("settings:PATCH:initialize_defaults", err);
    }

    delete body.onboarding_complete;
  }

  // Save remaining fields to user_settings
  if (Object.keys(body).length > 0) {
    try {
      await saveUserSettings(user.id, body as Parameters<typeof saveUserSettings>[1]);
    } catch (err) {
      return catchErrorResponse("settings:PATCH", err);
    }
  }

  // Invalidate the user's cache so they get fresh results with new settings
  const { error: cacheError } = await db
    .from("user_jobs_cache")
    .update({ cached_at: "2000-01-01T00:00:00Z" }) // epoch forces rebuild
    .eq("user_id", user.id);
  if (cacheError) return dbErrorResponse("settings:PATCH:invalidate_cache", cacheError);

  return NextResponse.json({ ok: true });
}
