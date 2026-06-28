// src/lib/settings.ts
// Resolves per-user settings by merging user_settings with default_settings.
// Each field falls back to the default when the user's value is null.
//
// IMPORTANT: defaults are a one-time starting point, not a live subscription.
// initializeUserSettingsForSignup() snapshots default_settings into a new
// user's row at signup. From then on, the per-field `?? default` fallback
// below only covers genuinely-missing data (e.g. a row that predates this
// snapshot, or a field added after the user signed up) — it must never be
// relied on as an ongoing sync path. An admin changing default_settings
// must not change what an existing user sees. See
// docs/plans/2026-06-28-defaults-snapshot-on-signup.md.

import { createAdminClient } from "./supabase/admin";
import { createServerClient } from "./supabase/server";
import type {
  DefaultSettings,
  UserSettingsRow,
  ResolvedSettings,
  ScoringWeights,
  SeniorityLevel,
} from "./types";

// Pure evaluation criteria only — no response-format instructions here.
// The JSON contract is owned by code (see RESPONSE_FORMAT_INSTRUCTIONS in
// gemini.ts) precisely so a user editing this field can never again break
// the parser. See docs/plans/2026-06-24-gemini-index-based-matching.md.
const FALLBACK_PROMPT = `You are a job filter for a Senior React/Next.js engineer. Evaluate each job listing on whether it's a genuine fit for this profile, based on seniority, relevant tech stack, and role type.`;

const FALLBACK_DEFAULTS: ResolvedSettings = {
  expert_skills: [
    "React",
    "TypeScript",
    "JavaScript",
    "HTML",
    "CSS",
    "Redux",
    "React Query",
    "Zustand",
    "MobX",
    "Tailwind",
    "Material UI",
    "Sass",
    "Next.js",
    "Vite",
    "Webpack",
  ],
  secondary_skills: [
    "Jest",
    "Vitest",
    "Testing Library",
    "React Native",
    "GraphQL",
    "WebSockets",
    "Storybook",
  ],
  bonus_skills: [
    "Node.js",
    "Express",
    "MongoDB",
    "PostgreSQL",
    "AWS",
    "Docker",
    "Git",
    "Redis",
    "Kubernetes",
  ],
  job_age_days: 7,
  pipeline_local: true,
  pipeline_global: true,
  junior_keywords: ["junior", "jr", "entry-level", "entry level", "intern", "graduate"],
  mid_keywords: ["mid-level", "mid level", "mid-senior", "intermediate"],
  senior_keywords: ["senior", "sr", "lead"],
  staff_keywords: ["staff", "principal", "architect", "director", "vp", "head"],
  seniority_levels: ["senior", "staff"],
  gemini_filter_prompt: FALLBACK_PROMPT,
  scoring_weights: { skill: 0.6, recency: 0.3, relocation: 0.1 },
  score_denominator: 18,
  excluded_keywords: [
    "backend",
    "back-end",
    "fullstack",
    "full-stack",
    "devops",
    "dev-ops",
    "sre",
    "site reliability",
    "platform engineer",
    "infrastructure",
    "cloud engineer",
    "security engineer",
    "network engineer",
    "embedded",
    "firmware",
    "mlops",
    "ml-ops",
    "database reliability",
    "dbre",
    "database engineer",
    "dba",
    "sysadmin",
    "system administrator",
    "data engineer",
    "data scientist",
    "data analyst",
    "machine learning",
    "project manager",
    "program manager",
    "product manager",
    "product owner",
    "account manager",
    "scrum master",
    "operations manager",
    "sales manager",
    "business analyst",
    "customer success",
    "support engineer",
    "helpdesk",
    "help desk",
    "service desk",
    "recruiter",
    "hr manager",
    "finance",
    "accountant",
    "marketing",
    "compliance",
    "product designer",
    "ux designer",
    "quality assurance",
    "automation tester",
    "test engineer",
    "hardware",
  ],
  blacklisted_locations: [
    "israel",
    "tel aviv",
    "tel-aviv",
    "haifa",
    "herzliya",
    "jerusalem",
    "ra'anana",
    "us only",
    "usa only",
    "united states only",
    "uk only",
    "united kingdom only",
    "canada only",
    "europe only",
    "americas only",
    "amer only",
    "latam only",
    "apac only",
    "security clearance required",
    "must be a us citizen",
    "us citizenship required",
    "cannot provide visa sponsorship",
    "unable to provide visa sponsorship",
    "we are unable to offer visa",
    "no visa sponsorship",
    "unable to sponsor",
  ],
  required_keywords: ["react", "next.js", "react native", "react.js", "reactjs"],
  global_mode_blocked_regions: [
    "us only",
    "usa only",
    "united states only",
    "north america only",
    "canada only",
    "pst",
    "est",
    "cst",
    "mst",
    "pacific time",
    "eastern time",
    "remote us",
    "remote usa",
    "remote united states",
  ],
  global_mode_allowed_locations: ["remote", "worldwide", "anywhere", "emea", "europe", "global"],
  email_alerts_enabled: true,
  salary_reminder_enabled: true,
};

/** Fetch the single default_settings row. Falls back to hardcoded if DB unreachable. */
export async function getDefaultSettings(): Promise<DefaultSettings> {
  const db = createAdminClient();
  const { data, error } = await db.from("default_settings").select("*").eq("id", 1).single();

  if (error || !data) {
    // Return a synthetic DefaultSettings matching the fallback
    return {
      id: 1,
      ...FALLBACK_DEFAULTS,
      email_alerts_enabled: true,
      salary_reminder_enabled: true,
      updated_at: new Date().toISOString(),
    } as DefaultSettings;
  }

  return data as unknown as DefaultSettings;
}

/** Fetch user_settings row. Returns null if the row doesn't exist. */
async function getUserSettingsRow(userId: string): Promise<UserSettingsRow | null> {
  const db = createServerClient();
  const { data, error } = await db.from("user_settings").select("*").eq("user_id", userId).single();

  if (error) return null;
  return data as unknown as UserSettingsRow;
}

/**
 * Resolves the effective settings for a user.
 * Per-field merge: user value (if non-null) wins; otherwise default applies.
 *
 * This is called by:
 *  - The dashboard route (to know which pipelines to enable, job_age_days, etc.)
 *  - The scoring engine (to know skill lists and weights)
 *  - The Gemini filter (to know the prompt and user's API key)
 */
export async function resolveUserSettings(userId: string): Promise<ResolvedSettings> {
  const [defaults, userRow] = await Promise.all([getDefaultSettings(), getUserSettingsRow(userId)]);

  return mergeWithDefaults(defaults, userRow);
}

function mergeWithDefaults(
  defaults: DefaultSettings,
  user: UserSettingsRow | null,
): ResolvedSettings {
  const rawWeights = user?.scoring_weights ?? defaults.scoring_weights;
  const weights = normaliseWeights(rawWeights);

  return {
    expert_skills: user?.expert_skills ?? defaults.expert_skills,
    secondary_skills: user?.secondary_skills ?? defaults.secondary_skills,
    bonus_skills: user?.bonus_skills ?? defaults.bonus_skills,
    job_age_days: user?.job_age_days ?? defaults.job_age_days,
    pipeline_local: user?.pipeline_local ?? defaults.pipeline_local,
    pipeline_global: user?.pipeline_global ?? defaults.pipeline_global,
    junior_keywords: user?.junior_keywords ?? defaults.junior_keywords,
    mid_keywords: user?.mid_keywords ?? defaults.mid_keywords,
    senior_keywords: user?.senior_keywords ?? defaults.senior_keywords,
    staff_keywords: user?.staff_keywords ?? defaults.staff_keywords,
    seniority_levels: (user?.seniority_levels ?? defaults.seniority_levels) as SeniorityLevel[],
    gemini_filter_prompt:
      user?.gemini_filter_prompt ?? defaults.gemini_filter_prompt ?? FALLBACK_PROMPT,
    scoring_weights: weights,
    score_denominator: user?.score_denominator ?? defaults.score_denominator,
    excluded_keywords: user?.excluded_keywords ?? defaults.excluded_keywords,
    blacklisted_locations: user?.blacklisted_locations ?? defaults.blacklisted_locations,
    required_keywords: user?.required_keywords ?? defaults.required_keywords,
    global_mode_blocked_regions:
      user?.global_mode_blocked_regions ?? defaults.global_mode_blocked_regions,
    global_mode_allowed_locations:
      user?.global_mode_allowed_locations ?? defaults.global_mode_allowed_locations,
    email_alerts_enabled: user?.email_alerts_enabled ?? defaults.email_alerts_enabled,
    salary_reminder_enabled: user?.salary_reminder_enabled ?? defaults.salary_reminder_enabled,
  };
}

/**
 * Normalises scoring weights so they always sum to 1.
 * Guards against misconfigured values in the DB.
 */
function normaliseWeights(raw: ScoringWeights | null | undefined): ScoringWeights {
  if (!raw) return { skill: 0.6, recency: 0.3, relocation: 0.1 };

  const { skill = 0.6, recency = 0.3, relocation = 0.1 } = raw;
  const total = skill + recency + relocation;

  if (total === 0) return { skill: 0.6, recency: 0.3, relocation: 0.1 };
  if (Math.abs(total - 1) < 0.001) return { skill, recency, relocation };

  return {
    skill: skill / total,
    recency: recency / total,
    relocation: relocation / total,
  };
}

/**
 * Upserts a user_settings row.
 * NEVER accepts a `role` field – that is enforced at both the API layer and here.
 */
export async function saveUserSettings(
  userId: string,
  patch: Partial<Omit<UserSettingsRow, "user_id" | "updated_at">>,
): Promise<void> {
  const db = createServerClient();

  // Strip anything that isn't a settings field
  const safe: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = [
    "expert_skills",
    "secondary_skills",
    "bonus_skills",
    "job_age_days",
    "pipeline_local",
    "pipeline_global",
    "junior_keywords",
    "mid_keywords",
    "senior_keywords",
    "staff_keywords",
    "seniority_levels",
    "gemini_filter_prompt",
    "scoring_weights",
    "score_denominator",
    "excluded_keywords",
    "blacklisted_locations",
    "required_keywords",
    "global_mode_blocked_regions",
    "global_mode_allowed_locations",
    "email_alerts_enabled",
    "salary_reminder_enabled",
  ];

  for (const key of allowed) {
    if (key in patch) safe[key] = (patch as Record<string, unknown>)[key];
  }

  const { error } = await db
    .from("user_settings")
    .upsert({ user_id: userId, ...safe }, { onConflict: "user_id" });

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}

/**
 * Snapshots the current default_settings into a new user's row, once, at
 * signup. This is the ONLY place default values get copied into a user's
 * profile. After this call, the row is the user's own data — later admin
 * edits to default_settings must never touch it again (that's the bug this
 * function replaces: the old `uses_defaults` flag re-read defaults live on
 * every request instead of copying them once).
 *
 * Safe to call more than once: if the user already has a row (e.g. this
 * fires twice, or a row was created some other way), it's left untouched
 * rather than overwritten.
 */
export async function initializeUserSettingsForSignup(userId: string): Promise<void> {
  const db = createServerClient();

  const { data: existing } = await db
    .from("user_settings")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return; // already initialized — never clobber

  const defaults = await getDefaultSettings();

  const { error } = await db.from("user_settings").insert({
    user_id: userId,
    expert_skills: defaults.expert_skills,
    secondary_skills: defaults.secondary_skills,
    bonus_skills: defaults.bonus_skills,
    job_age_days: defaults.job_age_days,
    pipeline_local: defaults.pipeline_local,
    pipeline_global: defaults.pipeline_global,
    junior_keywords: defaults.junior_keywords,
    mid_keywords: defaults.mid_keywords,
    senior_keywords: defaults.senior_keywords,
    staff_keywords: defaults.staff_keywords,
    seniority_levels: defaults.seniority_levels,
    gemini_filter_prompt: defaults.gemini_filter_prompt,
    scoring_weights: { ...defaults.scoring_weights },
    score_denominator: defaults.score_denominator,
    excluded_keywords: defaults.excluded_keywords,
    blacklisted_locations: defaults.blacklisted_locations,
    required_keywords: defaults.required_keywords,
    global_mode_blocked_regions: defaults.global_mode_blocked_regions,
    global_mode_allowed_locations: defaults.global_mode_allowed_locations,
    email_alerts_enabled: defaults.email_alerts_enabled,
    salary_reminder_enabled: defaults.salary_reminder_enabled,
    updated_at: new Date().toISOString(),
  });

  // Don't fail onboarding over this — resolveUserSettings() still falls
  // back to live defaults per-field if the row is missing/partial, so the
  // user isn't blocked. Surface it for visibility instead.
  if (error) console.error("initializeUserSettingsForSignup failed:", error.message);
}
