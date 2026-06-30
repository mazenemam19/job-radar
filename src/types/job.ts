import type { JobMode } from "@/lib/types";

export type JobSource = "company" | "local";

export interface Job {
  id: string;
  source: JobSource;
  mode: JobMode;
  sourceName?: string;
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
  dateUnknown?: boolean;
  visaSponsorship: boolean;
  matchedSkills: string[];
  bonusSkills: string[];
  missingSkills: string[];
  skillMatchScore: number;
  recencyScore: number;
  relocationBonus: number;
  totalScore: number;
  redFlags?: string[];
  fetchedAt: string;
  geminiPassed?: boolean;
  geminiReason?: string;
}
