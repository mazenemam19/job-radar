export interface Job {
  id: string;
  source: "arbeitnow" | "remotive" | "jobicy" | "remoteok";
  title: string;
  company: string;
  location: string;
  country: string;
  countryFlag: string;
  url: string;
  description: string;
  salary?: string;
  postedAt: string; // ISO date string
  visaSponsorship: boolean;
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
}

export interface CronLog {
  arbeitnowFetched: number;
  remotiveFetched: number;
  passedFilters: number;
  added: number;
  skipped: number;
}
