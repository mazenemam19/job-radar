// src/lib/types.ts

export type JobSource = "company";
export type JobMode = "visa" | "local";  // visa = remote+visa, local = egypt direct

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
  salary?: string;
  postedAt: string;
  visaSponsorship: boolean; // true for visa-mode jobs, false for local-mode
  matchedSkills: string[];
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