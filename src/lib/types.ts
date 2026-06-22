// src/lib/types.ts
// All shared TypeScript types for the SaaS layer.
// These are NEW types – they do not replace or extend the old Job type.

// ── ATS & Raw Jobs ──────────────────────────────────────────

export type ATSType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "teamtailor"
  | "breezy"
  | "smartrecruiters"
  | "bamboohr"
  | "jazzhr";

/** Row from public.ats_companies */
export interface ATSCompanyRow {
  id: string;
  name: string;
  ats: ATSType;
  slug: string;
  country: string;
  country_flag: string;
  city: string | null;
  pipeline_visa: boolean;
  pipeline_local: boolean;
  pipeline_global: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Normalised job as stored in public.raw_jobs */
export interface RawJob {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  country_flag: string;
  url: string;
  description: string;
  /** ISO string; equals fetched_at when date_unknown = true */
  posted_at: string;
  fetched_at: string;
  date_unknown: boolean;
  is_remote: boolean;
  salary: string | null;
  mode: "visa" | "local" | "global";
  visa_sponsorship: boolean;
  source_name: string | null;
  ats_type: string | null;
  created_at: string;
}

// ── Scoring ─────────────────────────────────────────────────

export interface ScoringWeights {
  skill: number; // must sum to 1 with recency + relocation
  recency: number;
  relocation: number;
}

/** A job after scoring – stored in user_jobs_cache.jobs (JSONB array) */
export interface ScoredJob extends RawJob {
  skill_match_score: number; // 0-100
  recency_score: number; // always computed live in UI, stored for reference
  relocation_bonus: number; // 0 or 100
  total_score: number; // weighted composite 0-100
  matched_skills: string[]; // skills found in description
  bonus_skills: string[]; // nice-to-have skills found, informational only — never scored
  gemini_pass: boolean;
  gemini_reason: string | null;
  scoring_weights?: ScoringWeights;
}

/** Snapshot stored in tracker_entries.job_snapshot */
export interface TrackerJobSnapshot {
  title: string;
  company: string;
  url: string;
  location: string;
  country: string;
  country_flag: string;
  mode: "visa" | "local" | "global";
  total_score: number;
  matched_skills: string[];
  posted_at: string;
}

// ── Settings ────────────────────────────────────────────────

export interface DefaultSettings {
  id: 1;
  expert_skills: string[];
  secondary_skills: string[];
  bonus_skills: string[];
  job_age_days: number;
  pipeline_visa: boolean;
  pipeline_local: boolean;
  pipeline_global: boolean;
  seniority_allow_mid: boolean;
  gemini_filter_prompt: string | null;
  scoring_weights: ScoringWeights;
  score_denominator: number;
  excluded_keywords: string[];
  blacklisted_locations: string[];
  required_keywords: string[];
  email_alerts_enabled: boolean;
  updated_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  uses_defaults: boolean;
  expert_skills: string[] | null;
  secondary_skills: string[] | null;
  bonus_skills: string[] | null;
  job_age_days: number | null;
  pipeline_visa: boolean | null;
  pipeline_local: boolean | null;
  pipeline_global: boolean | null;
  seniority_allow_mid: boolean | null;
  gemini_filter_prompt: string | null;
  scoring_weights: ScoringWeights | null;
  score_denominator: number | null;
  excluded_keywords: string[] | null;
  blacklisted_locations: string[] | null;
  required_keywords: string[] | null;
  email_alerts_enabled: boolean | null;
  updated_at: string;
}

/** The fully resolved settings object used for scoring/filtering */
export interface ResolvedSettings {
  expert_skills: string[];
  secondary_skills: string[];
  bonus_skills: string[];
  job_age_days: number;
  pipeline_visa: boolean;
  pipeline_local: boolean;
  pipeline_global: boolean;
  seniority_allow_mid: boolean;
  gemini_filter_prompt: string;
  scoring_weights: ScoringWeights;
  score_denominator: number;
  excluded_keywords: string[];
  blacklisted_locations: string[];
  required_keywords: string[];
  email_alerts_enabled: boolean;
}

// ── User Profile ────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  role: "admin" | "user";
  gemini_api_key: string | null;
  onboarding_complete: boolean;
  is_active: boolean;
  created_at: string;
  last_active_at: string | null;
}

// ── Pipeline Log (stored in user_jobs_cache.pipeline_log) ───

export interface PipelineLog {
  total_fetched: number;
  after_date_filter: number;
  after_settings_filter: number;
  after_gemini: number;
  cached_at: string;
}

// ── Tracker ─────────────────────────────────────────────────

export type TrackerStatus = "applied" | "interviewing" | "offer" | "rejected" | "ghosted" | "saved";

export interface TrackerEntry {
  id: string;
  user_id: string;
  job_id: string;
  job_snapshot: TrackerJobSnapshot;
  status: TrackerStatus;
  notes: string | null;
  applied_at: string | null;
  last_status_change: string;
  created_at: string;
  updated_at: string;
}

// ── Salary ──────────────────────────────────────────────────

export type SalaryCurrency = "EGP" | "USD" | "EUR" | "GBP";
export type EmploymentType = "full-time" | "part-time" | "contract" | "freelance";
export type WorkArrangement = "onsite" | "remote" | "hybrid";
export type Pipeline = "local" | "global" | "visa";

export interface SalaryReport {
  id: string;
  user_id: string | null;
  role_title: string;
  years_experience: number;
  salary_egp: number | null;
  salary_usd: number | null;
  currency: SalaryCurrency;
  employment_type: EmploymentType | null;
  work_arrangement: WorkArrangement | null;
  pipeline: Pipeline | null;
  reported_at: string;
  reminder_sent_at: string | null;
  last_updated_at: string;
}

export interface SalaryAggregate {
  role_title: string;
  years_experience: number;
  currency: SalaryCurrency;
  min: number;
  max: number;
  median: number;
  count: number;
  pipeline: Pipeline | null;
}

// ── ATS Submissions ─────────────────────────────────────────

export interface ATSTestResult {
  ok: boolean;
  jobs_found: number;
  error: string | null;
  tested_at: string;
}

// ── Cron ────────────────────────────────────────────────────

export interface CronRunResult {
  total_fetched: number;
  duration_ms: number;
  errors: string[];
  source_health: Record<string, { fetched: number; errors: number; company: string }>;
  trigger: "github_actions" | "vercel_cron" | "manual";
}
