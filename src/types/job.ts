import { CronLog } from "./health";

export type JobSource = "company" | "local";
export type JobMode = "visa" | "local" | "global"; // visa = remote+visa, local = egypt direct, global = worldwide remote Egypt-friendly

export interface Job {
  id: string;
  source: JobSource;
  mode: JobMode; // which pipeline produced this job
  sourceName?: string; // The name of the source (e.g. company name or board name)
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
