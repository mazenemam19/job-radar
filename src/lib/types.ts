// src/lib/types.ts
// All shared TypeScript types for the SaaS layer.
// Domain types for the SaaS layer.

// ── ATS & Raw Jobs ──────────────────────────────────────────

export type ATSType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "teamtailor"
  | "breezy"
  | "smartrecruiters"
  | "bamboohr";

export type JobMode = "local" | "global";

export type FilterMode = "all" | "local" | "global";

/** Seniority levels, ordinal-ranked for display purposes. */
export type SeniorityLevel = "junior" | "mid" | "senior" | "staff";

/** Row from public.ats_companies */
export interface ATSCompanyRow {
  id: string;
  name: string;
  ats: ATSType;
  slug: string;
  country: string;
  country_flag: string;
  city: string | null;
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
  mode: JobMode;
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
  /** true only when Gemini returned a real, matched decision for this job;
   *  false when it fell through a fail-open path (missing idx or batch
   *  failure). */
  gemini_reviewed: boolean;
  /** true only when gemini_reviewed is false specifically because every
   *  model in the queue was quota-exhausted, not some other failure mode.
   *  Drives a distinct "quota exhausted" badge instead of the generic
   *  "not AI-reviewed" one. */
  gemini_quota_exhausted?: boolean;
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
  mode: JobMode;
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
  pipeline_local: boolean;
  pipeline_global: boolean;
  junior_keywords: string[];
  mid_keywords: string[];
  senior_keywords: string[];
  staff_keywords: string[];
  seniority_levels: SeniorityLevel[];
  gemini_filter_prompt: string | null;
  scoring_weights: ScoringWeights;
  score_denominator: number;
  excluded_keywords: string[];
  blacklisted_locations: string[];
  required_keywords: string[];
  global_mode_blocked_regions: string[];
  global_mode_allowed_locations: string[];
  email_alerts_enabled: boolean;
  salary_reminder_enabled: boolean;
  updated_at: string;
}

export interface UserSettingsRow {
  user_id: string;
  expert_skills: string[] | null;
  secondary_skills: string[] | null;
  bonus_skills: string[] | null;
  job_age_days: number | null;
  pipeline_local: boolean | null;
  pipeline_global: boolean | null;
  junior_keywords: string[] | null;
  mid_keywords: string[] | null;
  senior_keywords: string[] | null;
  staff_keywords: string[] | null;
  seniority_levels: SeniorityLevel[] | null;
  gemini_filter_prompt: string | null;
  scoring_weights: ScoringWeights | null;
  score_denominator: number | null;
  excluded_keywords: string[] | null;
  blacklisted_locations: string[] | null;
  required_keywords: string[] | null;
  global_mode_blocked_regions: string[] | null;
  global_mode_allowed_locations: string[] | null;
  email_alerts_enabled: boolean | null;
  salary_reminder_enabled: boolean | null;
  updated_at: string;
}

/** The fully resolved settings object used for scoring/filtering */
export interface ResolvedSettings {
  expert_skills: string[];
  secondary_skills: string[];
  bonus_skills: string[];
  job_age_days: number;
  pipeline_local: boolean;
  pipeline_global: boolean;
  junior_keywords: string[];
  mid_keywords: string[];
  senior_keywords: string[];
  staff_keywords: string[];
  seniority_levels: SeniorityLevel[];
  gemini_filter_prompt: string;
  scoring_weights: ScoringWeights;
  score_denominator: number;
  excluded_keywords: string[];
  blacklisted_locations: string[];
  required_keywords: string[];
  global_mode_blocked_regions: string[];
  global_mode_allowed_locations: string[];
  email_alerts_enabled: boolean;
  salary_reminder_enabled: boolean;
}

/** Editable state backing the settings form. Comma-separated list fields are
 *  kept as raw strings while being edited and only split into arrays when
 *  building the save payload (see src/lib/settings-form.ts). */
export interface SettingsFormFields {
  geminiKey: string;
  clearGeminiKey: boolean;
  expertSkills: string;
  secondarySkills: string;
  jobAgeDays: number;
  pipelineLocal: boolean;
  pipelineGlobal: boolean;
  seniorityLevels: Set<SeniorityLevel>;
  juniorKeywords: string;
  midKeywords: string;
  seniorKeywords: string;
  staffKeywords: string;
  emailAlerts: boolean;
  salaryReminders: boolean;
  geminiPrompt: string;
  skillWeight: number;
  recencyWeight: number;
  excludedKeywords: string;
  blacklistedLocations: string;
  requiredKeywords: string;
  globalBlockedRegions: string;
  globalAllowedLocations: string;
}

export interface SettingsData {
  resolved: ResolvedSettings;
  raw: UserSettingsRow | null;
  profile: { email: string; has_gemini_key: boolean; onboarding_complete: boolean };
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
export type Pipeline = "local" | "global";

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

export type ATSSubmissionStatus = "pending" | "approved" | "rejected";

/** Row from public.ats_submissions */
export interface ATSSubmission {
  id: string;
  company_name: string;
  ats_type: ATSType;
  slug: string;
  country: string;
  country_flag: string;
  city: string | null;
  pipeline_local: boolean;
  pipeline_global: boolean;
  submitter_email: string | null;
  status: ATSSubmissionStatus;
  test_result: ATSTestResult | null;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// ── Admin ────────────────────────────────────────────────────

/** Shape returned by GET /api/admin/users — user_profiles joined with user_settings */
export interface AdminUserListItem {
  id: string;
  email: string;
  role: "admin" | "user";
  onboarding_complete: boolean;
  is_active: boolean;
  created_at: string;
  last_active_at: string | null;
}

// ── Cron ────────────────────────────────────────────────────

export interface EmailSendResult {
  email: string;
  sent: boolean;
  error?: string;
  messageId?: string;
}

export interface CronRunResult {
  total_fetched: number;
  duration_ms: number;
  errors: string[];
  /** Non-blocking issues (e.g. a few dead per-job detail links) — kept out
   * of `errors` since they didn't fail anything. Persisted to
   * cron_logs_v2.warnings — requires migration
   * supabase/migrations/0001_cron_logs_v2_add_warnings.sql to be run by
   * hand first (this repo has no migration runner). Until that migration
   * runs, PostgREST rejects the insert in runner.ts with a "column
   * cron_logs_v2.warnings does not exist" error — caught by the existing
   * logError handling (see runner.ts), so the cron run itself still
   * completes, but that run gets no cron_logs_v2 row at all until the
   * migration is applied. Run the migration before/with this deploy. */
  warnings: string[];
  source_health: Record<string, { fetched: number; errors: number; company: string }>;
  trigger: "github_actions" | "vercel_cron" | "manual";
  email_results?: EmailSendResult[];
}
