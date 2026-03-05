// src/lib/types.ts

export type JobSource = "company" | "local";
export type JobMode = "visa" | "local" | "global"; // visa = remote+visa, local = egypt direct, global = worldwide remote Egypt-friendly

export interface Job {
  id: string;
  source: JobSource;
  mode: JobMode; // which pipeline produced this job
  title: string;
  company: string;
  location: string;
  country: string;
  countryFlag: string;
  url: string;
  description: string;
  isRemote?: boolean;
  salary?: string;
  postedAt: string;
  dateUnknown?: boolean; // true when API returned no date — shown as "Date N/A" in UI
  visaSponsorship: boolean; // true for visa-mode jobs, false for local-mode
  matchedSkills: string[]; // Tier 2 frontend skills found
  bonusSkills: string[]; // Tier 3 backend/infra (shown in UI, not scored)
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
  fetchedAt: string;
  geminiPassed?: boolean;
  geminiReason?: string;
}

export interface JobStore {
  jobs: Job[];
  lastUpdated: string;
  cronLogs: CronLog[];
}

export interface SourceHealth {
  count: number;
  rawCount?: number;
  geminiFiltered?: number;
  error?: string;
  durationMs?: number;
  ats?: string;
  status?: "ok" | "error" | "zero" | "skipped";
  // Lifetime stats
  success?: number;
  total?: number;
}

export interface CronLog {
  runAt: string;
  newJobs: number;
  totalJobs: number;
  sources: Record<string, number>; // Legacy: per-mode counts
  sourceDetails?: Record<string, SourceHealth>; // New: granular per-source health
  durationMs: number;
  errors: string[];
}

// ── Lifetime Health Store ───────────────────────────────────────────────────
export interface HealthStat {
  success: number;
  total: number;
}
export type HealthStore = Record<string, HealthStat>;

// ── Shared Fetcher Types ──────────────────────────────────────────────────

export interface BaseCompany {
  name: string;
  country: string;
  countryFlag: string;
  city?: string;
}

export interface ATSConfig extends BaseCompany {
  ats:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "workable"
    | "teamtailor"
    | "breezy"
    | "smartrecruiters"
    | "bamboohr"
    | "jazzhr";
  slug: string;
}

export interface RawJob {
  id: string;
  title: string;
  location: string;
  url: string;
  postedAt: string;
  description: string;
  company?: string;
  locationRestrictions?: string[];
}

export interface FetcherResult {
  jobs: Job[];
  rawCount?: number;
  error?: string;
  durationMs?: number;
}

// ── ATS Specific Response Types ───────────────────────────────────────────

export interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string } | null;
  absolute_url: string;
  updated_at: string;
  content: string;
}

export interface LeverJob {
  id: string;
  text: string;
  categories: { location: string } | null;
  hostedUrl: string;
  createdAt: number;
  description: string;
}

export interface AshbyJob {
  id: string;
  title: string;
  locationName: string;
  jobUrl: string;
  publishedAt: string;
  descriptionHtml: string;
}

export interface WorkableJob {
  shortcode: string;
  title: string;
  city: string;
  url: string;
  published_on: string;
  description: string;
}

export interface WorkableDetail {
  full_description?: string;
  description?: string;
}

export interface TeamtailorJob {
  id: string;
  attributes: {
    title: string;
    "location-name": string | null;
    "external-url": string | null;
    "published-at": string;
    "body-html": string;
  };
}

export interface BreezyJob {
  id: string;
  name: string;
  location?: { name: string };
  url: string;
  updated_at: string;
  description: string;
}

export interface SRJob {
  id: string;
  name: string;
  ref: string;
  location: { fullLocation: string };
  releasedDate: string;
}

export interface SRDetail {
  jobAd?: {
    sections?: {
      jobDescription?: {
        content?: string;
      };
    };
  };
}

export interface BambooJob {
  id: string;
  jobOpeningName: string;
  city: string;
  country: string;
  datePosted: string;
}

export interface JazzJob {
  id: string;
  title: string;
  location: string;
  apply_url: string;
  posted: string;
  description: string;
}

export interface WuzzufJob {
  id: string;
  attributes: {
    title: string;
    slug?: string;
    description: string;
    workplaceArrangement?: string;
    postedAt: string;
    location?: {
      city?: { name: string };
      country?: { name: string };
    };
    company_name?: string;
    computedFields?: { name: string; value: string[] }[];
  };
}

export interface WuzzufSearchResponse {
  data: { id: string }[];
}

export interface WuzzufDetailResponse {
  data: WuzzufJob[];
}

export interface RemoteOKJob {
  id: string;
  position: string;
  description: string;
  date: string;
  company: string;
  url: string;
}

export interface HimalayasJob {
  title: string;
  companyName: string;
  locationRestrictions?: string[];
  applicationLink: string;
  description: string;
  pubDate: number;
  guid: string;
}

export interface RemotiveJob {
  id: string;
  title: string;
  description: string;
  candidate_required_location: string;
  publication_date: string;
  company_name: string;
  url: string;
}

export interface WordPressPost {
  id: number;
  title: { rendered: string };
  link: string;
  date_gmt: string;
  content: { rendered: string };
}

// ── State Types ───────────────────────────────────────────────────────────

export interface ScanState {
  workableOffsets: Record<string, number>;
}

// ── Scoring Types ─────────────────────────────────────────────────────────

export interface ScoreInput {
  title: string;
  description: string;
  location: string;
  postedAt: string;
}

export interface ScoreResult {
  matchedSkills: string[];
  bonusSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
}

// ── Component Types ───────────────────────────────────────────────────────

export interface AppHeaderProps {
  lastUpdated?: string;
  onRefresh?: () => Promise<void>;
  cronSecret?: string;
}
export interface SourceSummary {
  name: string;
  totalRuns: number;
  successRate: number;
  lastCount: number;
  lastRawCount?: number;
  lastGeminiFiltered?: number;
  lastError?: string;
  avgDuration?: number;
  status: "healthy" | "nomatch" | "warning" | "error" | "skipped";
  success?: number;
  total?: number;
}
