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
  fetchJazzHR,
} from "@/lib/sources/ats-utils";

import type { ATSCompanyRow, RawJob, JobMode } from "./types";
import type { Job } from "@/types";

import type { ATSConfig } from "@/types";

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
export async function fetchCompany(row: ATSCompanyRow, mode: JobMode): Promise<FetchResult> {
  const config = toATSConfig(row);
  const fetchedAt = new Date().toISOString();
  const fetchedMs = Date.parse(fetchedAt);

  try {
    let rawJobs: Job[] = [];
    let fetchError: string | null = null;

    // All fetchers compute visa_sponsorship from content internally.
    switch (row.ats) {
      case "greenhouse": {
        const result = await fetchGreenhouse(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "lever": {
        const result = await fetchLever(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "ashby": {
        const result = await fetchAshby(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "workable": {
        const result = await fetchWorkable(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "teamtailor": {
        const result = await fetchTeamtailor(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "breezy": {
        const result = await fetchBreezy(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "smartrecruiters": {
        const result = await fetchSmartRecruiters(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "bamboohr": {
        const result = await fetchBambooHR(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      case "jazzhr": {
        const result = await fetchJazzHR(config, mode);
        rawJobs = result.jobs;
        if (result.error) fetchError = result.error;
        break;
      }
      default:
        throw new Error(`Unknown ATS type: ${row.ats}`);
    }

    // Normalise and detect date_unknown (fallback date)
    const jobs: RawJob[] = rawJobs.map((j) => {
      const postedAt = (j.postedAt ?? fetchedAt) as string;
      const postedMs = Date.parse(postedAt);

      const dateUnknown = Number.isNaN(postedMs) || Math.abs(postedMs - fetchedMs) < 30_000;

      return {
        id: j.id,
        title: j.title,
        company: j.company ?? row.name,
        location: j.location ?? "",
        country: row.country,
        country_flag: row.country_flag,
        url: j.url,
        description: j.description ?? "",
        posted_at: dateUnknown ? fetchedAt : postedAt,
        fetched_at: fetchedAt,
        date_unknown: dateUnknown,
        is_remote: Boolean(j.isRemote ?? false),
        salary: j.salary ?? null,
        mode,
        visa_sponsorship: Boolean(j.visaSponsorship ?? false),
        source_name: row.name,
        ats_type: row.ats,
        created_at: fetchedAt,
      };
    });

    return { company: row.name, mode, jobs, error: fetchError };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { company: row.name, mode, jobs: [], error };
  }
}
