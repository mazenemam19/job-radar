import type { JobMode } from "@/lib/types";
import type { WorkAuthorizationStatus } from "@/lib/job-signals";

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
  workAuthorizationStatus?: WorkAuthorizationStatus;
  workAuthorizationEvidence?: string | null;
  sourceLocation?: string;
  city?: string | null;
  countryCode?: string | null;
  workplaceType?: "on_site" | "hybrid" | "remote" | "unknown";
  employmentTypes?: import("@/lib/types").JobEmploymentType[];
  languageRequirements?: string[];
  languageEvidence?: string | null;
}
