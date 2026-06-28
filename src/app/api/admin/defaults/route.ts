// src/app/api/admin/defaults/route.ts

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { dbErrorResponse } from "@/lib/api-errors";
import { getDefaultSettings } from "@/lib/settings";
import type { Database } from "@/lib/database.types";

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

  const patch: Database["public"]["Tables"]["default_settings"]["Update"] = {
    updated_at: new Date().toISOString(),
  };

  if ("expert_skills" in body && Array.isArray(body.expert_skills)) {
    patch.expert_skills = body.expert_skills.filter((s): s is string => typeof s === "string");
  }
  if ("secondary_skills" in body && Array.isArray(body.secondary_skills)) {
    patch.secondary_skills = body.secondary_skills.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if ("bonus_skills" in body && Array.isArray(body.bonus_skills)) {
    patch.bonus_skills = body.bonus_skills.filter((s): s is string => typeof s === "string");
  }
  if ("excluded_keywords" in body && Array.isArray(body.excluded_keywords)) {
    patch.excluded_keywords = body.excluded_keywords.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if ("blacklisted_locations" in body && Array.isArray(body.blacklisted_locations)) {
    patch.blacklisted_locations = body.blacklisted_locations.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if ("required_keywords" in body && Array.isArray(body.required_keywords)) {
    patch.required_keywords = body.required_keywords.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if ("global_mode_blocked_regions" in body && Array.isArray(body.global_mode_blocked_regions)) {
    patch.global_mode_blocked_regions = body.global_mode_blocked_regions.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if (
    "global_mode_allowed_locations" in body &&
    Array.isArray(body.global_mode_allowed_locations)
  ) {
    patch.global_mode_allowed_locations = body.global_mode_allowed_locations.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if ("job_age_days" in body && typeof body.job_age_days === "number") {
    patch.job_age_days = body.job_age_days;
  }
  if ("pipeline_local" in body && typeof body.pipeline_local === "boolean") {
    patch.pipeline_local = body.pipeline_local;
  }
  if ("pipeline_global" in body && typeof body.pipeline_global === "boolean") {
    patch.pipeline_global = body.pipeline_global;
  }
  if ("junior_keywords" in body && Array.isArray(body.junior_keywords)) {
    patch.junior_keywords = body.junior_keywords.filter((s): s is string => typeof s === "string");
  }
  if ("mid_keywords" in body && Array.isArray(body.mid_keywords)) {
    patch.mid_keywords = body.mid_keywords.filter((s): s is string => typeof s === "string");
  }
  if ("senior_keywords" in body && Array.isArray(body.senior_keywords)) {
    patch.senior_keywords = body.senior_keywords.filter((s): s is string => typeof s === "string");
  }
  if ("staff_keywords" in body && Array.isArray(body.staff_keywords)) {
    patch.staff_keywords = body.staff_keywords.filter((s): s is string => typeof s === "string");
  }
  if ("seniority_levels" in body && Array.isArray(body.seniority_levels)) {
    patch.seniority_levels = body.seniority_levels.filter(
      (s): s is string => typeof s === "string",
    );
  }
  if ("gemini_filter_prompt" in body) {
    patch.gemini_filter_prompt =
      typeof body.gemini_filter_prompt === "string" ? body.gemini_filter_prompt : null;
  }
  if ("score_denominator" in body && typeof body.score_denominator === "number") {
    patch.score_denominator = body.score_denominator;
  }
  if (
    "scoring_weights" in body &&
    body.scoring_weights &&
    typeof body.scoring_weights === "object"
  ) {
    const w = body.scoring_weights as Record<string, unknown>;
    const skill = typeof w.skill === "number" ? w.skill : 0;
    const recency = typeof w.recency === "number" ? w.recency : 0;
    const relocation = typeof w.relocation === "number" ? w.relocation : 0;

    if (Math.abs(skill + recency + relocation - 1) > 0.01) {
      return NextResponse.json(
        { ok: false, error: "scoring_weights must sum to 1" },
        { status: 400 },
      );
    }
    patch.scoring_weights = { skill, recency, relocation };
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("default_settings")
    .update(patch)
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
