// src/lib/settings.ts
// Resolves per-user settings by merging user_settings with default_settings.
// Each field falls back to the default when the user's value is null.
// If uses_defaults = true, returns defaults directly (fast path).

import { createAdminClient } from "./supabase/admin";
import { createServerClient } from "./supabase/server";
import type { DefaultSettings, UserSettingsRow, ResolvedSettings, ScoringWeights } from "./types";

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
  pipeline_visa: true,
  pipeline_local: true,
  pipeline_global: true,
  seniority_allow_mid: false,
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
  email_alerts_enabled: true,
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
  return data as UserSettingsRow;
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

  if (!userRow) {
    return mergeWithDefaults(defaults, null);
  }

  // If uses_defaults is true, we ignore user's custom skills/prompt
  // but still respect their pipeline/seniority/age/weights/denominator/keywords choices!
  if (userRow.uses_defaults) {
    return {
      expert_skills: defaults.expert_skills,
      secondary_skills: defaults.secondary_skills,
      bonus_skills: defaults.bonus_skills,
      gemini_filter_prompt: defaults.gemini_filter_prompt ?? FALLBACK_PROMPT,
      scoring_weights: normaliseWeights(userRow.scoring_weights ?? defaults.scoring_weights),
      score_denominator: userRow.score_denominator ?? defaults.score_denominator,

      // Respect user's choices for these:
      job_age_days: userRow.job_age_days ?? defaults.job_age_days,
      pipeline_visa: userRow.pipeline_visa ?? defaults.pipeline_visa,
      pipeline_local: userRow.pipeline_local ?? defaults.pipeline_local,
      pipeline_global: userRow.pipeline_global ?? defaults.pipeline_global,
      seniority_allow_mid: userRow.seniority_allow_mid ?? defaults.seniority_allow_mid,
      excluded_keywords: userRow.excluded_keywords ?? defaults.excluded_keywords,
      blacklisted_locations: userRow.blacklisted_locations ?? defaults.blacklisted_locations,
      required_keywords: userRow.required_keywords ?? defaults.required_keywords,
      email_alerts_enabled: userRow.email_alerts_enabled ?? defaults.email_alerts_enabled,
    };
  }

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
    pipeline_visa: user?.pipeline_visa ?? defaults.pipeline_visa,
    pipeline_local: user?.pipeline_local ?? defaults.pipeline_local,
    pipeline_global: user?.pipeline_global ?? defaults.pipeline_global,
    seniority_allow_mid: user?.seniority_allow_mid ?? defaults.seniority_allow_mid,
    gemini_filter_prompt:
      user?.gemini_filter_prompt ?? defaults.gemini_filter_prompt ?? FALLBACK_PROMPT,
    scoring_weights: weights,
    score_denominator: user?.score_denominator ?? defaults.score_denominator,
    excluded_keywords: user?.excluded_keywords ?? defaults.excluded_keywords,
    blacklisted_locations: user?.blacklisted_locations ?? defaults.blacklisted_locations,
    required_keywords: user?.required_keywords ?? defaults.required_keywords,
    email_alerts_enabled: user?.email_alerts_enabled ?? defaults.email_alerts_enabled,
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
    "uses_defaults",
    "expert_skills",
    "secondary_skills",
    "bonus_skills",
    "job_age_days",
    "pipeline_visa",
    "pipeline_local",
    "pipeline_global",
    "seniority_allow_mid",
    "gemini_filter_prompt",
    "scoring_weights",
    "score_denominator",
    "excluded_keywords",
    "blacklisted_locations",
    "required_keywords",
    "email_alerts_enabled",
  ];

  for (const key of allowed) {
    if (key in patch) safe[key] = (patch as Record<string, unknown>)[key];
  }

  const { error } = await db
    .from("user_settings")
    .upsert({ user_id: userId, ...safe }, { onConflict: "user_id" });

  if (error) throw new Error(`Failed to save settings: ${error.message}`);
}
