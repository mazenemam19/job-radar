// src/lib/types.ts

export type JobSource = "company";
export type JobMode = "visa" | "local" | "global";  // visa = remote+visa, local = egypt direct, global = worldwide remote Egypt-friendly

export interface Job {
  id: string;
  source: JobSource;
  mode: JobMode;       // which pipeline produced this job
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
  dateUnknown?: boolean;    // true when API returned no date — shown as "Date N/A" in UI
  visaSponsorship: boolean; // true for visa-mode jobs, false for local-mode
  matchedSkills: string[];   // Tier 2 frontend skills found
  bonusSkills: string[];     // Tier 3 backend/infra (shown in UI, not scored)
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
  fetchedAt: string;
}

export interface JobStore {
  jobs: Job[];
  lastUpdated: string;
  cronLogs: CronLog[];
}

export interface CronLog {
  runAt: string;
  newJobs: number;
  totalJobs: number;
  sources: Record<string, number>;
  durationMs: number;
  errors: string[];
}