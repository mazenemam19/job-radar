// src/lib/ats-bridge.ts
// Bridges DB-sourced company rows (from public.ats_companies) to the existing
// ATS fetcher functions, re-exported from src/lib/sources/ats-utils.ts (the
// implementation now lives in src/lib/sources/ats/ — see AUDIT_STATUS.md row #2).
//
// IMPORTANT: We IMPORT the fetchers but NEVER change their behavior here.
// The fetchers expect a company config object that matches what ALL_COMPANIES
// currently provides. This file performs the structural translation.

import {
  fetchGreenhouse,
  fetchLever,
  fetchAshby,
  fetchWorkable,
  fetchTeamtailor,
  fetchBreezy,
  fetchSmartRecruiters,
  fetchBambooHR,
} from "@/lib/sources/ats-utils";
import { createHash } from "node:crypto";

import type { ATSCompanyRow, RawJob, JobMode } from "./types";
import type { Job } from "@/types";

import type { ATSConfig, FetcherResult } from "@/types";

// All fetchers share this signature; dispatch is a lookup, not a branch per ATS.
type Fetcher = (config: ATSConfig, mode: JobMode, signal?: AbortSignal) => Promise<FetcherResult>;

const FETCHERS: Record<ATSConfig["ats"], Fetcher> = {
  greenhouse: fetchGreenhouse,
  lever: fetchLever,
  ashby: fetchAshby,
  workable: fetchWorkable,
  teamtailor: fetchTeamtailor,
  breezy: fetchBreezy,
  smartrecruiters: fetchSmartRecruiters,
  bamboohr: fetchBambooHR,
};

function canonicalPostingId(ats: string, sourceId: string, url: string): string {
  // Fetchers historically prefixed their provider job IDs with the pipeline
  // name (for example `local_gh_acme_42` and `global_gh_acme_42`). The
  // provider ID is the durable identity; URLs are only a fallback. In
  // particular, some boards put that ID in a query parameter, so stripping
  // every query parameter would incorrectly collapse different postings.
  let identity = sourceId.trim().replace(/^(?:local|global|visa)_/, "") || url.trim();
  try {
    const parsed = new URL(identity);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    identity = parsed.toString();
  } catch {
    identity = identity.toLowerCase();
  }
  const digest = createHash("sha256").update(`${ats}:${identity}`).digest("hex").slice(0, 40);
  return `${ats}_${digest}`;
}

/** Convert a DB row + pipeline mode to the ATSConfig shape. */
function toATSConfig(row: ATSCompanyRow): ATSConfig {
  return {
    name: row.name,
    ats: row.ats as ATSConfig["ats"],
    slug: row.slug,
    country: row.country,
    countryFlag: row.country_flag,
    city: row.city ?? undefined,
  };
}

/** Result from a single company fetch attempt. */
interface FetchResult {
  company: string;
  mode: JobMode;
  jobs: RawJob[];
  error: string | null;
  /** Non-blocking issues from the fetcher (see FetcherResult.warnings). */
  warnings?: string[];
}

/**
 * Fetches jobs from a single company using the appropriate ATS fetcher.
 *
 * Jobs are tagged with the mode (local/global) from the pipeline.
 * Returns raw jobs with date_unknown correctly set:
 * date_unknown is set when postedAt ≈ fetchedAt (fallback date);
 * fetchedAt is then used as posted_at so the job decays normally.
 *
 * Mode is "local" | "global" only.
 * visa_sponsorship is computed by each fetcher from content (regex),
 * not from the pipeline flag.
 */
export async function fetchCompany(
  row: ATSCompanyRow,
  mode: JobMode,
  signal?: AbortSignal,
): Promise<FetchResult> {
  const config = toATSConfig(row);
  const fetchedAt = new Date().toISOString();
  const fetchedMs = Date.parse(fetchedAt);

  try {
    // All fetchers compute visa_sponsorship from content internally.
    const fetcher = FETCHERS[row.ats];
    if (!fetcher) throw new Error(`Unknown ATS type: ${row.ats}`);

    const result = await fetcher(config, mode, signal);
    const rawJobs: Job[] = result.jobs;
    const fetchError: string | null = result.error ?? null;
    const fetchWarnings = result.warnings;

    // Normalise and detect date_unknown (fallback date)
    const jobs: RawJob[] = rawJobs.map((j) => {
      const postedAt = (j.postedAt ?? fetchedAt) as string;
      const postedMs = Date.parse(postedAt);

      const dateUnknown = Number.isNaN(postedMs) || Math.abs(postedMs - fetchedMs) < 30_000;

      return {
        id: canonicalPostingId(row.ats, j.id, j.url),
        source_id: j.id,
        title: j.title,
        company: j.company ?? row.name,
        location: j.location ?? "",
        country: j.country,
        country_flag: j.countryFlag,
        url: j.url,
        description: j.description ?? "",
        posted_at: dateUnknown ? fetchedAt : postedAt,
        fetched_at: fetchedAt,
        date_unknown: dateUnknown,
        is_remote: Boolean(j.isRemote ?? false),
        salary: j.salary ?? null,
        mode: j.mode ?? mode,
        visa_sponsorship: Boolean(j.visaSponsorship ?? false),
        work_authorization_status: j.workAuthorizationStatus ?? "unclear",
        work_authorization_evidence: j.workAuthorizationEvidence ?? null,
        source_location: j.sourceLocation ?? j.location,
        country_code: j.countryCode ?? null,
        city: j.city ?? null,
        workplace_type: j.workplaceType ?? "unknown",
        employment_types: j.employmentTypes ?? [],
        language_requirements: j.languageRequirements ?? [],
        language_evidence: j.languageEvidence ?? null,
        source_name: row.name,
        ats_type: row.ats,
        created_at: fetchedAt,
      };
    });

    return { company: row.name, mode, jobs, error: fetchError, warnings: fetchWarnings };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { company: row.name, mode, jobs: [], error };
  }
}
