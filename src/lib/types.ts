// src/lib/types.ts

export type JobSource = "company";

export interface Job {
  id: string;             // e.g. "company_monzo_12345"
  source: JobSource;
  title: string;
  company: string;
  location: string;
  country: string;
  countryFlag: string;
  url: string;
  description: string;
  salary?: string;
  postedAt: string;       // ISO string from ATS
  visaSponsorship: true;  // Always true — that's the whole point of this list
  matchedSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;   // 0–100 (0 = filtered out, < MIN_CORE_SKILLS)
  recencyScore: number;      // 0–100 (100 = today, 0 = 60+ days old)
  relocationBonus: number;   // 0 or 10
  totalScore: number;        // 0.6*skill + 0.3*recency + 0.1*relocation
  fetchedAt: string;         // ISO string of when we scraped it
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
