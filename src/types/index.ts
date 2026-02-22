export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  country: string;
  countryCode: string;
  description: string;
  url: string;
  postedAt: string; // ISO date string
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  source: "adzuna" | "reed";
  tags: string[];
  hasVisaSponsorship: boolean;
  hasRelocation: boolean;

  // Computed after matching
  matchScore: number; // 0–100
  matchedSkills: string[];
  missingSkills: string[];
  recencyScore: number; // 0–100
  totalScore: number; // weighted final score
  fetchedAt: string; // ISO date string
}

export interface StorageData {
  jobs: Job[];
  lastFetchedAt: string | null;
  totalFetched: number;
}

export interface FilterState {
  country: string;
  minScore: number;
  visaOnly: boolean;
  relocationOnly: boolean;
  search: string;
}

export interface CronResult {
  added: number;
  updated: number;
  skipped: number;
  total: number;
  errors: string[];
}
