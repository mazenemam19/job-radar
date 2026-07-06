import { Job } from "./job";

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
    | "bamboohr";
  slug: string;
}

export interface ATSRawInput {
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
  /** Non-blocking issues that didn't fail the fetch (e.g. a handful of dead
   * per-job detail links on an otherwise-successful board). Distinct from
   * `error`: an `error` means the fetch failed, `warnings` means it
   * succeeded with a caveat worth surfacing. */
  warnings?: string[];
  durationMs?: number;
  ok?: boolean; // CURRENT run success
  success?: number; // Lifetime success count
  total?: number; // Lifetime total count
}

// ── ATS Specific Response Types ───────────────────────────────────────────

export interface GreenhouseJob {
  id: number;
  title: string;
  location: { name: string } | null;
  offices: Array<{ name: string; location: string | null }>;
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

/** Shape of GET https://{slug}.bamboohr.com/careers/{id}/detail.
 * Only the field this codebase actually reads. */
export interface BambooDetail {
  result?: {
    jobOpening?: {
      description?: string;
    };
  };
}

// ── Internal Fetcher Types ───────────────────────────────────────────────

export interface GeminiFilterResult {
  passed: boolean;
  reason: string;
  quote?: string; // Supporting quote from the description for rejections
  id: string;
  redFlags?: string[];
}

export type DomainCounts = Record<string, number>;

export interface WorkableCooldownEntry {
  slug: string;
  until: string;
}

export type WorkableBudgetConfig = { global: number; local: number };
